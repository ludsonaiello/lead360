# Admin Backend Dev 5: Template Enhancements & Testing

**Developer**: Backend Developer 5  
**Duration**: 6 days  
**Prerequisites**: Read `ADMIN_BACKEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Enhance template system with testing and validation:
- Template preview with sample/real data
- Template validation
- PDF test generation
- Email preview
- Template versioning

---

## API ENDPOINTS TO IMPLEMENT

### Preview Template with Sample Data
**Endpoint**: `POST /admin/quotes/templates/:id/preview`

**Request Body**:
```
{
  preview_type: "minimal" | "standard" | "complex",
  use_real_quote: boolean,
  quote_id: string | null
}
```

**Response**:
```
{
  rendered_html: string,
  rendered_css: string,
  preview_url: string,
  expires_at: string
}
```

**Preview Types**:
- Minimal: Few items, no discounts, simple
- Standard: Moderate items, one discount, typical
- Complex: Many items, groups, multiple discounts, attachments

**Process**:
- If use_real_quote: fetch actual quote data
- Else: generate sample data based on preview_type
- Render template with data (Handlebars)
- Store rendered HTML temporarily
- Return preview URL

---

### Test PDF Generation
**Endpoint**: `POST /admin/quotes/templates/:id/test-pdf`

**Request Body**:
```
{
  preview_type: "minimal" | "standard" | "complex",
  quote_id: string | null
}
```

**Response**:
```
{
  pdf_url: string,
  file_size_bytes: number,
  generation_time_ms: number,
  expires_at: string,
  warnings: array | null
}
```

**Process**:
- Generate sample or use real quote
- Render template
- Generate PDF
- Store temporarily
- Return download URL

**Warnings**:
- Template too wide for PDF
- Font issues
- Image resolution problems

---

### Validate Template Syntax
**Endpoint**: `POST /admin/quotes/templates/:id/validate`

**Response**:
```
{
  is_valid: boolean,
  errors: [
    {
      line: number,
      column: number,
      message: string,
      severity: "error" | "warning"
    }
  ],
  warnings: array,
  unused_variables: array,
  missing_required_variables: array
}
```

**Validation Checks**:
- Handlebars syntax valid
- All required variables present
- No undefined variables referenced
- HTML structure valid
- CSS syntax valid

---

### Test Email Rendering
**Endpoint**: `POST /admin/quotes/templates/:id/test-email`

**Request Body**:
```
{
  preview_type: string,
  send_to_email: string | null
}
```

**Response**:
```
{
  html_preview: string,
  text_preview: string,
  subject_line: string,
  test_email_sent: boolean,
  email_job_id: string | null
}
```

**Process**:
- Render template
- Generate both HTML and plain text versions
- If send_to_email provided: queue test email
- Return preview

---

### Get Template Version History
**Endpoint**: `GET /admin/quotes/templates/:id/versions`

**Response**:
```
{
  template_id: string,
  current_version: number,
  versions: [
    {
      version: number,
      created_at: string,
      created_by: string,
      changes_summary: string,
      html_content_snapshot: string
    }
  ]
}
```

**Business Logic**:
- Store template snapshots on each update
- Track version numbers
- Allow comparison between versions

---

### Restore Template Version
**Endpoint**: `POST /admin/quotes/templates/:id/restore-version`

**Request Body**:
```
{
  version: number,
  create_backup: boolean
}
```

**Response**:
```
{
  message: "Template restored to version X",
  new_current_version: number,
  backup_created: boolean
}
```

**Process**:
- If create_backup: snapshot current version first
- Restore content from specified version
- Increment version number

---

## SERVICE LAYER

Create `AdminTemplateTestingService`:

**Methods**:
- `previewTemplate(templateId, previewType, quoteId?)`
- `testPDFGeneration(templateId, previewType, quoteId?)`
- `validateTemplateSyntax(templateId)`
- `testEmailRendering(templateId, previewType, sendToEmail?)`
- `getTemplateVersionHistory(templateId)`
- `restoreTemplateVersion(templateId, version, createBackup)`

**Helper Methods**:
- `generateSampleQuoteData(previewType)`
- `renderTemplate(template, data)`
- `detectTemplateWarnings(template)`
- `createTemplateSnapshot(template, changedBy)`

---

## SAMPLE DATA GENERATOR

Create realistic sample data:

**Minimal Quote**:
- 3-5 items
- Single group
- No discounts
- Basic customer info

**Standard Quote**:
- 10-15 items
- 2-3 groups
- One percentage discount
- Complete customer details
- Vendor info

**Complex Quote**:
- 25+ items
- 4-5 groups
- Multiple discounts
- Attachments (placeholder)
- Draw schedule
- Warranty tiers

---

## TEMPLATE VERSIONING

Store in database:

**Table**: `quote_template_version`
- `id` (UUID)
- `template_id` (UUID, FK)
- `version_number` (integer)
- `html_content` (text)
- `css_content` (text)
- `changes_summary` (string)
- `created_by` (UUID, FK to user)
- `created_at` (timestamp)

**Trigger**: Create version on template update

---

## TESTING REQUIREMENTS

### Unit Tests
- Test sample data generation
- Test template rendering
- Test syntax validation
- Test version creation

### Integration Tests
- Preview template with each preview type
- Generate PDF from template
- Validate valid and invalid templates
- Test email rendering
- Test version restore

---

## DELIVERABLES

1. `AdminTemplateTestingController` (6 endpoints)
2. `AdminTemplateTestingService`
3. Sample data generator
4. Template version system
5. Validation engine
6. Tests
7. Documentation

---

## COMPLETION CRITERIA

- All 6 endpoints functional
- Preview works with all types
- PDF generation successful
- Validation catches syntax errors
- Email rendering works
- Version history functional
- Tests pass