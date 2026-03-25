import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { StorageProviderFactory } from '../../../core/file-storage/storage-provider.factory';

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

      // Step 11: Parse receipt text
      const parsed = this.parseReceiptText(fullText);

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
  // 4. updateReceiptOcrResult — Persist OCR results to receipt record
  // ---------------------------------------------------------------------------

  async updateReceiptOcrResult(
    receiptId: string,
    result: {
      ocr_raw: string;
      ocr_vendor: string | null;
      ocr_amount: number | null;
      ocr_date: Date | null;
    },
  ): Promise<void> {
    const hasAnyField =
      result.ocr_vendor || result.ocr_amount != null || result.ocr_date;

    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocr_raw: result.ocr_raw,
        ocr_vendor: result.ocr_vendor,
        ocr_amount: result.ocr_amount,
        ocr_date: result.ocr_date,
        ocr_status: hasAnyField ? 'complete' : 'failed',
      },
    });

    this.logger.log(
      `OCR result saved for receipt ${receiptId}: status=${hasAnyField ? 'complete' : 'failed'}, ` +
        `vendor=${result.ocr_vendor || 'N/A'}, amount=${result.ocr_amount ?? 'N/A'}, ` +
        `date=${result.ocr_date ? result.ocr_date.toISOString() : 'N/A'}`,
    );
  }
}
