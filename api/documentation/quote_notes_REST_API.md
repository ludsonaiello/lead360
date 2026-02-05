# Quote Notes REST API Documentation

**Version**: 1.0
**Last Updated**: February 1, 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Overview

The Quote Notes API provides a complete note-taking system for quotes, allowing users to add timestamped, user-attributed notes with pinning support. All notes are automatically tracked with creation/update timestamps and linked to the user who created them.

### Key Features

- **User Attribution**: Every note tracks who created it
- **Timestamps**: Automatic creation and update timestamps
- **Pinning**: Pin important notes to the top
- **Audit Logging**: All note operations are logged to the audit log
- **Pagination**: List endpoint supports pagination
- **Soft Retrieval**: Deleted users show as null (notes preserved)

---

## Authentication & Authorization

All endpoints require JWT Bearer token authentication.

```
Authorization: Bearer {jwt-token}
```

`tenant_id` and `user_id` are extracted from the JWT token server-side.

### RBAC Roles by Endpoint

| Endpoint | Allowed Roles | Note |
|----------|--------------|------|
| POST `/quotes/:id/notes` | Owner, Admin, Manager, Sales | Create note |
| GET `/quotes/:id/notes` | Owner, Admin, Manager, Sales, Field | List notes (read-only for Field) |
| PATCH `/quotes/:id/notes/:noteId` | Owner, Admin, Manager, Sales | Update note |
| DELETE `/quotes/:id/notes/:noteId` | Owner, Admin, Manager, Sales | Delete note |

---

## Data Transfer Objects (DTOs)

### CreateQuoteNoteDto

Request body for creating a new note.

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `note_text` | string | **YES** | MaxLength: 5000, NotEmpty | Note content | `"Customer requested site visit before finalizing materials"` |
| `is_pinned` | boolean | NO | - | Pin note to top (default: false) | `false` |

**TypeScript Type**:
```typescript
interface CreateQuoteNoteDto {
  note_text: string;
  is_pinned?: boolean;
}
```

---

### UpdateQuoteNoteDto

Request body for updating an existing note.

| Field | Type | Required | Validation | Description | Example |
|-------|------|----------|------------|-------------|---------|
| `note_text` | string | NO | MaxLength: 5000 | Updated note content | `"Customer confirmed site visit scheduled for next week"` |
| `is_pinned` | boolean | NO | - | Update pinned status | `true` |

**TypeScript Type**:
```typescript
interface UpdateQuoteNoteDto {
  note_text?: string;
  is_pinned?: boolean;
}
```

---

### QuoteNoteResponseDto

Response object for a single note.

| Field | Type | Always Present | Description | Example |
|-------|------|----------------|-------------|---------|
| `id` | string | YES | Note UUID | `"123e4567-e89b-12d3-a456-426614174000"` |
| `quote_id` | string | YES | Quote UUID | `"987e6543-e89b-12d3-a456-426614174111"` |
| `note_text` | string | YES | Note content | `"Customer requested site visit"` |
| `is_pinned` | boolean | YES | Whether note is pinned | `false` |
| `user` | object \| null | YES | User who created note (null if deleted) | `{ id, first_name, last_name, email }` |
| `created_at` | string | YES | ISO 8601 timestamp | `"2026-02-01T10:30:00.000Z"` |
| `updated_at` | string | YES | ISO 8601 timestamp | `"2026-02-01T14:45:00.000Z"` |

**User object structure**:
```typescript
{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}
```

**Full TypeScript Type**:
```typescript
interface QuoteNoteResponseDto {
  id: string;
  quote_id: string;
  note_text: string;
  is_pinned: boolean;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}
```

---

### QuoteNotesListResponseDto

Response object for listing notes.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `notes` | QuoteNoteResponseDto[] | Array of notes | `[...]` |
| `total` | number | Total number of notes | `5` |

**TypeScript Type**:
```typescript
interface QuoteNotesListResponseDto {
  notes: QuoteNoteResponseDto[];
  total: number;
}
```

---

## API Endpoints

### 1. Create Quote Note

Create a new note for a quote.

```
POST /api/v1/quotes/:id/notes
```

#### Authentication
- **Roles**: Owner, Admin, Manager, Sales
- **Bearer token required**

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | string | UUID | Quote UUID |

#### Request Body

```json
{
  "note_text": "Customer requested site visit before finalizing materials",
  "is_pinned": false
}
```

**Minimal request** (only required field):
```json
{
  "note_text": "Quick note about customer preferences"
}
```

#### Response: 201 Created

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "note_text": "Customer requested site visit before finalizing materials",
  "is_pinned": false,
  "user": {
    "id": "user-uuid-123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
  },
  "created_at": "2026-02-01T10:30:00.000Z",
  "updated_at": "2026-02-01T10:30:00.000Z"
}
```

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | `note_text` is empty | `"Note text cannot be empty"` |
| 400 | `note_text` exceeds 5000 characters | `"Note text cannot exceed 5000 characters"` |
| 400 | Invalid UUID in path | `"Validation failed (uuid is expected)"` |
| 404 | Quote not found | `"Quote with ID {quoteId} not found or access denied"` |

---

### 2. List Quote Notes

Get all notes for a quote with pagination.

```
GET /api/v1/quotes/:id/notes?page=1&limit=50
```

#### Authentication
- **Roles**: Owner, Admin, Manager, Sales, Field
- **Bearer token required**

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | string | UUID | Quote UUID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | NO | 1 | Page number |
| `limit` | number | NO | 50 | Items per page |

#### Response: 200 OK

```json
{
  "notes": [
    {
      "id": "pinned-note-uuid",
      "quote_id": "987e6543-e89b-12d3-a456-426614174111",
      "note_text": "URGENT: Customer needs answer by EOD",
      "is_pinned": true,
      "user": {
        "id": "user-uuid-123",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com"
      },
      "created_at": "2026-01-30T08:00:00.000Z",
      "updated_at": "2026-02-01T09:00:00.000Z"
    },
    {
      "id": "normal-note-uuid",
      "quote_id": "987e6543-e89b-12d3-a456-426614174111",
      "note_text": "Customer confirmed materials are acceptable",
      "is_pinned": false,
      "user": {
        "id": "user-uuid-456",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane.smith@example.com"
      },
      "created_at": "2026-02-01T10:30:00.000Z",
      "updated_at": "2026-02-01T10:30:00.000Z"
    }
  ],
  "total": 2
}
```

**Note about ordering**:
- Pinned notes (`is_pinned: true`) appear first
- Within each group (pinned/unpinned), notes are sorted by `created_at` descending (newest first)

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Invalid UUID in path | `"Validation failed (uuid is expected)"` |
| 404 | Quote not found | `"Quote with ID {quoteId} not found or access denied"` |

---

### 3. Update Quote Note

Update note text and/or pinned status.

```
PATCH /api/v1/quotes/:id/notes/:noteId
```

#### Authentication
- **Roles**: Owner, Admin, Manager, Sales
- **Bearer token required**

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | string | UUID | Quote UUID |
| `noteId` | string | UUID | Note UUID |

#### Request Body

Update text only:
```json
{
  "note_text": "Customer confirmed site visit scheduled for next week"
}
```

Update pinned status only:
```json
{
  "is_pinned": true
}
```

Update both:
```json
{
  "note_text": "URGENT: Customer needs answer by EOD",
  "is_pinned": true
}
```

#### Response: 200 OK

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "note_text": "URGENT: Customer needs answer by EOD",
  "is_pinned": true,
  "user": {
    "id": "user-uuid-123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
  },
  "created_at": "2026-02-01T10:30:00.000Z",
  "updated_at": "2026-02-01T14:45:00.000Z"
}
```

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | `note_text` is empty | `"Note text cannot be empty"` |
| 400 | `note_text` exceeds 5000 characters | `"Note text cannot exceed 5000 characters"` |
| 400 | Invalid UUID in path | `"Validation failed (uuid is expected)"` |
| 404 | Note not found | `"Note with ID {noteId} not found or access denied"` |

---

### 4. Delete Quote Note

Permanently delete a note.

```
DELETE /api/v1/quotes/:id/notes/:noteId
```

#### Authentication
- **Roles**: Owner, Admin, Manager, Sales
- **Bearer token required**

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | string | UUID | Quote UUID |
| `noteId` | string | UUID | Note UUID |

#### Response: 204 No Content

Empty response body.

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Invalid UUID in path | `"Validation failed (uuid is expected)"` |
| 404 | Note not found | `"Note with ID {noteId} not found or access denied"` |

---

## Audit Logging

All note operations are logged to the audit log with the following actions:

| Action Type | Description | Metadata |
|-------------|-------------|----------|
| `note_added` | Note created | `{ note_id, note_preview, is_pinned }` |
| `note_updated` | Note updated | `{ note_id, changes }` |
| `note_deleted` | Note deleted | `{ note_id, note_preview }` |

**Example audit log entry**:
```json
{
  "tenant_id": "tenant-uuid",
  "actor_user_id": "user-uuid",
  "actor_type": "user",
  "entity_type": "quote",
  "entity_id": "quote-uuid",
  "action_type": "note_added",
  "description": "Note added to quote QR-2026-1153",
  "metadata_json": "{\"note_id\":\"note-uuid\",\"note_preview\":\"Customer requested site visit...\",\"is_pinned\":false}"
}
```

---

## Frontend API Client Example

```typescript
// quote-notes.ts
import { apiClient } from './client';

const BASE_URL = '/api/v1/quotes';

export const quoteNotesApi = {
  // Create note
  async create(quoteId: string, data: CreateQuoteNoteDto): Promise<QuoteNoteResponseDto> {
    const response = await apiClient.post(`${BASE_URL}/${quoteId}/notes`, data);
    return response.data;
  },

  // List notes
  async list(
    quoteId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<QuoteNotesListResponseDto> {
    const response = await apiClient.get(`${BASE_URL}/${quoteId}/notes`, {
      params: { page, limit },
    });
    return response.data;
  },

  // Update note
  async update(
    quoteId: string,
    noteId: string,
    data: UpdateQuoteNoteDto
  ): Promise<QuoteNoteResponseDto> {
    const response = await apiClient.patch(
      `${BASE_URL}/${quoteId}/notes/${noteId}`,
      data
    );
    return response.data;
  },

  // Delete note
  async delete(quoteId: string, noteId: string): Promise<void> {
    await apiClient.delete(`${BASE_URL}/${quoteId}/notes/${noteId}`);
  },

  // Pin/unpin note (convenience method)
  async togglePin(
    quoteId: string,
    noteId: string,
    isPinned: boolean
  ): Promise<QuoteNoteResponseDto> {
    return this.update(quoteId, noteId, { is_pinned: isPinned });
  },
};
```

**Usage examples**:

```typescript
// Create a note
const newNote = await quoteNotesApi.create('quote-uuid-123', {
  note_text: 'Customer confirmed materials are acceptable',
  is_pinned: false,
});

// List all notes for a quote
const { notes, total } = await quoteNotesApi.list('quote-uuid-123');

// Pin a note
await quoteNotesApi.togglePin('quote-uuid-123', 'note-uuid-456', true);

// Update note text
await quoteNotesApi.update('quote-uuid-123', 'note-uuid-456', {
  note_text: 'Updated note content',
});

// Delete a note
await quoteNotesApi.delete('quote-uuid-123', 'note-uuid-456');
```

---

## Integration with Existing Quote Features

### Quote Details Page

When displaying a quote, you can fetch its notes:

```typescript
const quote = await quotesApi.get(quoteId);
const { notes } = await quoteNotesApi.list(quoteId);
```

### Notes Timeline UI

Display notes in a timeline format:
- Pinned notes at the top (with pin icon)
- Regular notes below (sorted newest first)
- Show user name and timestamp for each note
- Allow editing/deleting for users with appropriate permissions

---

## Common Use Cases

### 1. Add Quick Note
```typescript
await quoteNotesApi.create(quoteId, {
  note_text: 'Customer called - needs answer by Friday',
});
```

### 2. Pin Important Note
```typescript
await quoteNotesApi.togglePin(quoteId, noteId, true);
```

### 3. Load Notes History
```typescript
const { notes, total } = await quoteNotesApi.list(quoteId, 1, 50);
console.log(`Showing ${notes.length} of ${total} notes`);
```

### 4. Search Notes (Client-Side)
```typescript
const { notes } = await quoteNotesApi.list(quoteId);
const searchResults = notes.filter(note =>
  note.note_text.toLowerCase().includes(searchTerm.toLowerCase())
);
```

---

## Database Schema

```sql
CREATE TABLE `quote_note` (
  `id` VARCHAR(36) NOT NULL,
  `quote_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `note_text` TEXT NOT NULL,
  `is_pinned` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `quote_note_quote_id_created_at_idx`(`quote_id`, `created_at` DESC),
  INDEX `quote_note_quote_id_is_pinned_created_at_idx`(`quote_id`, `is_pinned` DESC, `created_at` DESC),
  CONSTRAINT `quote_note_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quote_note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Key Features**:
- `CASCADE` on quote deletion (all notes deleted with quote)
- `SET NULL` on user deletion (notes preserved, user shown as null)
- Indexed for efficient queries by quote_id and pinned status

---

**End of Documentation**
