import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { StorageProviderFactory } from '../../../core/file-storage/storage-provider.factory';
import OpenAI from 'openai';

/**
 * Structured result from AI or regex receipt parsing.
 * Maps directly to receipt OCR database fields.
 */
interface ParsedReceiptResult {
  ocr_vendor: string | null;
  ocr_amount: number | null;
  ocr_date: Date | null;
  ocr_tax: number | null;
  ocr_discount: number | null;
  ocr_subtotal: number | null;
  ocr_time: string | null;
  ocr_entry_type: string | null;
  ocr_line_items: any[] | null;
  ocr_notes: string | null;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly googleVisionApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageProviderFactory: StorageProviderFactory,
  ) {
    this.googleVisionApiKey =
      this.configService.get<string>('GOOGLE_VISION_API_KEY') || '';

    if (!this.googleVisionApiKey) {
      this.logger.warn(
        '⚠️ GOOGLE_VISION_API_KEY is not configured. OCR processing will not work. ' +
          'Set GOOGLE_VISION_API_KEY in your .env file to enable receipt OCR.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 1. processReceipt — Main orchestrator (called by BullMQ processor)
  // ---------------------------------------------------------------------------

  async processReceipt(
    receiptId: string,
    tenantId: string,
    fileId: string,
  ): Promise<void> {
    // Step 1: Check API key availability
    if (!this.googleVisionApiKey) {
      this.logger.warn(
        `OCR skipped for receipt ${receiptId}: GOOGLE_VISION_API_KEY not configured`,
      );
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocr_status: 'failed' },
      });
      return;
    }

    // Step 2: Fetch receipt from DB (tenant-scoped)
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, tenant_id: tenantId },
    });

    if (!receipt) {
      this.logger.error(
        `OCR aborted: receipt ${receiptId} not found for tenant ${tenantId}`,
      );
      return;
    }

    // Step 3: Verify receipt is in 'processing' state
    if (receipt.ocr_status !== 'processing') {
      this.logger.warn(
        `OCR skipped for receipt ${receiptId}: status is '${receipt.ocr_status}', expected 'processing'`,
      );
      return;
    }

    // Step 4: Fetch file record to get storage_path and id
    const fileRecord = await this.prisma.file.findFirst({
      where: { file_id: fileId },
      select: { id: true, storage_path: true },
    });

    if (!fileRecord) {
      this.logger.error(
        `OCR failed for receipt ${receiptId}: file record not found for file_id ${fileId}`,
      );
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocr_status: 'failed' },
      });
      return;
    }

    // Steps 5–10: File download → Vision API → Parse → Save (wrapped in try/catch)
    try {
      // Step 5: Get storage provider for tenant
      const provider = await this.storageProviderFactory.getProvider(tenantId);

      // Step 6: Download file buffer
      const buffer = await provider.download(
        fileRecord.id,
        fileRecord.storage_path,
      );

      // Step 7: Convert buffer to base64
      const imageBase64 = buffer.toString('base64');

      // Step 8: Call Vision API
      const apiResponse = await this.callVisionApi(imageBase64);

      // Step 8b: Write full raw OCR response to log file for analysis
      const rawJson = apiResponse ? JSON.stringify(apiResponse, null, 2) : null;
      try {
        const fs = await import('fs');
        const logPath = '/var/www/lead360.app/api/log-ocr-receipt.log';
        const timestamp = new Date().toISOString();
        const separator = '='.repeat(80);
        const logEntry = [
          separator,
          `[${timestamp}] OCR RESPONSE — Receipt: ${receiptId}`,
          `Response size: ${rawJson ? rawJson.length : 0} bytes`,
          separator,
          rawJson ?? '(null response)',
          '',
        ].join('\n');
        fs.appendFileSync(logPath, logEntry + '\n');
        this.logger.log(
          `OCR raw response for receipt ${receiptId} (${rawJson ? rawJson.length : 0} bytes) written to ${logPath}`,
        );
      } catch (fsError) {
        this.logger.warn(`Failed to write OCR log file: ${fsError.message}`);
      }

      // Step 9: Check for valid response
      if (
        !apiResponse ||
        !apiResponse.responses?.[0]?.fullTextAnnotation?.text
      ) {
        this.logger.warn(`OCR returned no text for receipt ${receiptId}`);
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: {
            ocr_status: 'failed',
            ocr_raw: apiResponse ? JSON.stringify(apiResponse) : null,
          },
        });
        return;
      }

      // Step 10: Extract full text
      const fullText = apiResponse.responses[0].fullTextAnnotation.text;

      // Step 11: Parse receipt text with AI (GPT-4o-mini) or fallback to regex
      const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
      let parsed: ParsedReceiptResult;

      if (openaiKey) {
        this.logger.log(`Using GPT-4o-mini for structured parsing of receipt ${receiptId}`);
        parsed = await this.parseReceiptWithAI(fullText, openaiKey);
      } else {
        this.logger.warn(`OPENAI_API_KEY not set — falling back to regex parsing for receipt ${receiptId}`);
        const regexResult = this.parseReceiptText(fullText);
        parsed = {
          ...regexResult,
          ocr_tax: null,
          ocr_discount: null,
          ocr_subtotal: null,
          ocr_time: null,
          ocr_entry_type: 'expense',
          ocr_line_items: null,
          ocr_notes: null,
        };
      }

      // Step 11b: Log parsed results to file
      try {
        const fs = await import('fs');
        const logPath = '/var/www/lead360.app/api/log-ocr-receipt.log';
        const timestamp = new Date().toISOString();
        const parseLog = [
          '-'.repeat(80),
          `[${timestamp}] PARSED RESULTS — Receipt: ${receiptId}`,
          '-'.repeat(80),
          'EXTRACTED FULL TEXT:',
          fullText,
          '',
          'PARSED FIELDS:',
          `  Vendor:     ${parsed.ocr_vendor ?? '(not detected)'}`,
          `  Total:      ${parsed.ocr_amount ?? '(not detected)'}`,
          `  Subtotal:   ${parsed.ocr_subtotal ?? '(not detected)'}`,
          `  Tax:        ${parsed.ocr_tax ?? '(not detected)'}`,
          `  Discount:   ${parsed.ocr_discount ?? '(not detected)'}`,
          `  Date:       ${parsed.ocr_date ? parsed.ocr_date.toISOString() : '(not detected)'}`,
          `  Time:       ${parsed.ocr_time ?? '(not detected)'}`,
          `  Type:       ${parsed.ocr_entry_type ?? '(not detected)'}`,
          `  Line Items: ${parsed.ocr_line_items ? JSON.stringify(parsed.ocr_line_items) : '(none)'}`,
          `  Notes:      ${parsed.ocr_notes ?? '(none)'}`,
          '',
        ].join('\n');
        fs.appendFileSync(logPath, parseLog + '\n');
      } catch (fsError) {
        this.logger.warn(`Failed to write OCR parse log: ${fsError.message}`);
      }

      // Step 12: Persist OCR results
      await this.updateReceiptOcrResult(receiptId, {
        ocr_raw: JSON.stringify(apiResponse),
        ...parsed,
      });
    } catch (error) {
      this.logger.error(
        `OCR processing failed for receipt ${receiptId}: ${error.message}`,
        error.stack,
      );

      // Re-throw so the BullMQ processor can retry with exponential backoff.
      // The processor sets ocr_status = 'failed' on the final attempt (attempt 3).
      // We intentionally do NOT set 'failed' here — the receipt stays in
      // 'processing' state so subsequent retry attempts are not skipped.
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. callVisionApi — HTTP call to Google Cloud Vision
  // ---------------------------------------------------------------------------

  private async callVisionApi(imageBase64: string): Promise<any> {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionApiKey}`;

    const requestBody = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Google Vision API error (${response.status}): ${errorText}`,
      );

      // Retryable: server errors (5xx) and rate limiting (429) — throw so
      // the BullMQ processor can retry with exponential backoff
      if (response.status >= 500 || response.status === 429) {
        throw new Error(
          `Google Vision API transient error (${response.status}): ${errorText}`,
        );
      }

      // Non-retryable: client errors (400, 401, 403, etc.) — return null
      // so processReceipt sets ocr_status = 'failed' immediately
      return null;
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // 3. parseReceiptText — Pure text parsing (PUBLIC for unit testing)
  // ---------------------------------------------------------------------------

  parseReceiptText(fullText: string): {
    ocr_vendor: string | null;
    ocr_amount: number | null;
    ocr_date: Date | null;
  } {
    if (!fullText || fullText.trim().length === 0) {
      return { ocr_vendor: null, ocr_amount: null, ocr_date: null };
    }

    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const ocr_vendor = this.extractVendor(lines);
    const ocr_amount = this.extractAmount(lines);
    const ocr_date = this.extractDate(fullText);

    return { ocr_vendor, ocr_amount, ocr_date };
  }

  // ---------------------------------------------------------------------------
  // 3a. extractVendor — First non-empty line is typically the business name
  // ---------------------------------------------------------------------------

  private extractVendor(lines: string[]): string | null {
    if (lines.length === 0) return null;

    // First non-empty line is usually the business name
    let vendor = lines[0];

    // If first line is too short (e.g., just a number or symbol), try second line
    if (vendor.length < 2 && lines.length > 1) {
      vendor = lines[1];
    }

    // Trim to max 200 chars (DB column limit)
    return vendor.substring(0, 200) || null;
  }

  // ---------------------------------------------------------------------------
  // 3b. extractAmount — Search for TOTAL keywords, then fallback to largest
  // ---------------------------------------------------------------------------

  private extractAmount(lines: string[]): number | null {
    const totalKeywords =
      /\b(TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|GRAND\s*TOTAL|TOTAL\s*DUE)\b/i;
    const amountPattern =
      /\$?\s?(\d{1,3}(?:,\d{3})*\.\d{2}|\d{1,6}\.\d{2})\b/g;

    const candidates: number[] = [];

    // First pass: look for amounts on lines containing TOTAL keywords
    for (const line of lines) {
      if (totalKeywords.test(line)) {
        let match: RegExpExecArray | null;
        const localPattern = new RegExp(amountPattern.source, 'g');
        while ((match = localPattern.exec(line)) !== null) {
          const raw = match[1].replace(/,/g, '');
          const value = parseFloat(raw);
          if (!isNaN(value) && value > 0) {
            candidates.push(value);
          }
        }
      }
    }

    // If we found candidates on TOTAL lines, return the largest
    if (candidates.length > 0) {
      return Math.max(...candidates);
    }

    // Fallback: search ALL lines for the largest dollar amount
    const allAmounts: number[] = [];
    for (const line of lines) {
      let match: RegExpExecArray | null;
      const localPattern = new RegExp(amountPattern.source, 'g');
      while ((match = localPattern.exec(line)) !== null) {
        const raw = match[1].replace(/,/g, '');
        const value = parseFloat(raw);
        if (!isNaN(value) && value > 0) {
          allAmounts.push(value);
        }
      }
    }

    if (allAmounts.length > 0) {
      return Math.max(...allAmounts);
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // 3c. extractDate — Search for date patterns in text
  // ---------------------------------------------------------------------------

  private extractDate(text: string): Date | null {
    // Pattern 1: MM/DD/YYYY or MM-DD-YYYY
    const slashDateFull = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
    const matchFull = text.match(slashDateFull);
    if (matchFull) {
      const date = new Date(
        `${matchFull[3]}-${matchFull[1].padStart(2, '0')}-${matchFull[2].padStart(2, '0')}T00:00:00`,
      );
      if (!isNaN(date.getTime())) return date;
    }

    // Pattern 2: MM/DD/YY or MM-DD-YY
    const slashDateShort = /(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/;
    const matchShort = text.match(slashDateShort);
    if (matchShort) {
      const year = parseInt(matchShort[3], 10);
      const fullYear = year >= 50 ? 1900 + year : 2000 + year;
      const date = new Date(
        `${fullYear}-${matchShort[1].padStart(2, '0')}-${matchShort[2].padStart(2, '0')}T00:00:00`,
      );
      if (!isNaN(date.getTime())) return date;
    }

    // Pattern 3: Month DD, YYYY (e.g., "March 15, 2026" or "Mar 15, 2026")
    const monthNames =
      'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
    const monthDatePattern = new RegExp(
      `(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
      'i',
    );
    const matchMonth = text.match(monthDatePattern);
    if (matchMonth) {
      const dateStr = `${matchMonth[1]} ${matchMonth[2]}, ${matchMonth[3]}`;
      const date = new Date(dateStr + ' 00:00:00');
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // 3d. parseReceiptWithAI — GPT-4o-mini structured extraction
  // ---------------------------------------------------------------------------

  private async parseReceiptWithAI(
    fullText: string,
    apiKey: string,
  ): Promise<ParsedReceiptResult> {
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a receipt parser. Extract structured data from receipt text.
Return ONLY valid JSON with this exact schema — no markdown, no explanation:

{
  "vendor": "string or null — the store/business name. Combine multi-line names (e.g., 'THE\\nHOME\\nDEPOT' → 'The Home Depot'). Ignore slogans, taglines, addresses, phone numbers.",
  "date": "string or null — YYYY-MM-DD format",
  "time": "string or null — HH:MM format (24h)",
  "entry_type": "'expense' or 'refund' — check for REFUND/RETURN/CREDIT keywords",
  "subtotal": "number or null — subtotal before tax and discount",
  "tax": "number or null — tax amount",
  "discount": "number or null — total discount/savings amount (positive number)",
  "total": "number or null — final amount paid",
  "line_items": [
    {
      "description": "string — product name/description. Ignore barcodes, SKUs, product IDs.",
      "quantity": "number — default 1 if not specified",
      "unit_price": "number — price per unit",
      "total": "number — quantity × unit_price"
    }
  ],
  "payment_method": "string or null — 'cash', 'credit_card', 'debit_card', etc.",
  "card_brand": "string or null — VISA, MASTERCARD, AMEX, DISCOVER, etc.",
  "card_last_four": "string or null — last 4 digits of card",
  "change_due": "number or null — change given back for cash payments",
  "notes": "string or null — any other relevant info (auth codes, transaction IDs, etc.)"
}

Rules:
- All monetary values must be positive numbers (no $ signs)
- For refunds: entry_type='refund', amounts are still positive
- Ignore: barcodes, UPC codes, product IDs, SKU numbers, store numbers, register numbers
- If a field cannot be determined, use null
- line_items should only include actual products/services, not subtotals/tax/total lines
- Combine split product names that span multiple lines into one description`;

    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        this.logger.log(`GPT-4o-mini parse attempt ${attempt}/${MAX_ATTEMPTS}`);

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullText },
          ],
          temperature: attempt === 1 ? 0 : 0.1 * attempt,
          max_tokens: 2000,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          this.logger.warn(`GPT-4o-mini attempt ${attempt}: empty response`);
          continue;
        }

        // Strip markdown code fences if present
        const jsonStr = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        let data: any;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseErr) {
          this.logger.warn(
            `GPT-4o-mini attempt ${attempt}: invalid JSON — ${parseErr.message}\nRaw: ${jsonStr.substring(0, 500)}`,
          );
          continue;
        }

        // Validate: must be an object with at least vendor or total
        if (!data || typeof data !== 'object') {
          this.logger.warn(`GPT-4o-mini attempt ${attempt}: response is not an object`);
          continue;
        }

        const hasUsableData = data.vendor || data.total != null || data.date ||
          (Array.isArray(data.line_items) && data.line_items.length > 0);

        if (!hasUsableData) {
          this.logger.warn(`GPT-4o-mini attempt ${attempt}: no usable data extracted`);
          continue;
        }

        // Valid result — build and return
        const notesParts: string[] = [];
        if (data.payment_method) notesParts.push(`Payment: ${data.payment_method}`);
        if (data.card_brand) notesParts.push(`Card: ${data.card_brand}`);
        if (data.card_last_four) notesParts.push(`ending ${data.card_last_four}`);
        if (data.change_due != null) notesParts.push(`Change: $${data.change_due}`);
        if (data.notes) notesParts.push(data.notes);

        this.logger.log(`GPT-4o-mini attempt ${attempt}: success`);

        return {
          ocr_vendor: data.vendor ? String(data.vendor).substring(0, 200) : null,
          ocr_amount: this.toSafeNumber(data.total),
          ocr_date: this.toSafeDate(data.date),
          ocr_tax: this.toSafeNumber(data.tax),
          ocr_discount: this.toSafeNumber(data.discount),
          ocr_subtotal: this.toSafeNumber(data.subtotal),
          ocr_time: data.time ? String(data.time).substring(0, 8) : null,
          ocr_entry_type: data.entry_type === 'refund' ? 'refund' : 'expense',
          ocr_line_items: Array.isArray(data.line_items) && data.line_items.length > 0
            ? data.line_items.map((item: any) => ({
                description: String(item.description || '').substring(0, 500),
                quantity: this.toSafeNumber(item.quantity) ?? 1,
                unit_price: this.toSafeNumber(item.unit_price) ?? 0,
                total: this.toSafeNumber(item.total) ?? 0,
              }))
            : null,
          ocr_notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
        };
      } catch (error) {
        this.logger.error(
          `GPT-4o-mini attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`,
        );
        if (attempt === MAX_ATTEMPTS) {
          this.logger.error('All GPT-4o-mini attempts exhausted — falling back to regex');
        }
      }
    }

    // All 3 attempts failed — fall back to regex
    const regexResult = this.parseReceiptText(fullText);
    return {
      ...regexResult,
      ocr_tax: null,
      ocr_discount: null,
      ocr_subtotal: null,
      ocr_time: null,
      ocr_entry_type: 'expense',
      ocr_line_items: null,
      ocr_notes: null,
    };
  }

  private emptyParsedResult(): ParsedReceiptResult {
    return {
      ocr_vendor: null,
      ocr_amount: null,
      ocr_date: null,
      ocr_tax: null,
      ocr_discount: null,
      ocr_subtotal: null,
      ocr_time: null,
      ocr_entry_type: null,
      ocr_line_items: null,
      ocr_notes: null,
    };
  }

  private toSafeNumber(val: any): number | null {
    if (val == null) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  private toSafeDate(val: any): Date | null {
    if (!val) return null;
    const date = new Date(String(val) + 'T00:00:00');
    return isNaN(date.getTime()) ? null : date;
  }

  // ---------------------------------------------------------------------------
  // 4. updateReceiptOcrResult — Persist OCR results to receipt record
  // ---------------------------------------------------------------------------

  async updateReceiptOcrResult(
    receiptId: string,
    result: ParsedReceiptResult & { ocr_raw: string },
  ): Promise<void> {
    const hasAnyField =
      result.ocr_vendor || result.ocr_amount != null || result.ocr_date ||
      result.ocr_line_items;

    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocr_raw: result.ocr_raw,
        ocr_vendor: result.ocr_vendor,
        ocr_amount: result.ocr_amount,
        ocr_date: result.ocr_date,
        ocr_tax: result.ocr_tax,
        ocr_discount: result.ocr_discount,
        ocr_subtotal: result.ocr_subtotal,
        ocr_time: result.ocr_time,
        ocr_entry_type: result.ocr_entry_type,
        ocr_line_items: result.ocr_line_items ? JSON.stringify(result.ocr_line_items) : null,
        ocr_notes: result.ocr_notes,
        ocr_status: hasAnyField ? 'complete' : 'failed',
      },
    });

    this.logger.log(
      `OCR result saved for receipt ${receiptId}: status=${hasAnyField ? 'complete' : 'failed'}, ` +
        `vendor=${result.ocr_vendor || 'N/A'}, total=${result.ocr_amount ?? 'N/A'}, ` +
        `tax=${result.ocr_tax ?? 'N/A'}, discount=${result.ocr_discount ?? 'N/A'}, ` +
        `items=${result.ocr_line_items ? result.ocr_line_items.length : 0}, ` +
        `type=${result.ocr_entry_type ?? 'N/A'}`,
    );
  }
}
