# Sprint 8: Operations & Maintenance

**Agent Role**: Senior Platform Operations & Troubleshooting Specialist
**Expertise**: System operations, incident management, bulk operations, data management
**Duration**: Complete implementation of 9 endpoints

---

## Sprint Goal

Implement day-to-day operational tools for admins, including alert management, communication event corrections, and bulk retry operations. This sprint completes the admin toolkit with troubleshooting and efficiency tools.

---

## Endpoints to Implement (9 Total)

### Alert Management (3 endpoints)
1. PATCH `/alerts/:id/acknowledge` - Acknowledge alert with comment
2. PATCH `/alerts/:id/resolve` - Resolve alert with resolution notes
3. POST `/alerts/bulk-acknowledge` - Bulk acknowledge multiple alerts

### Communication Event Management (3 endpoints)
4. POST `/communication-events/:id/resend` - Resend failed communication event
5. PATCH `/communication-events/:id/status` - Update communication event status
6. DELETE `/communication-events/:id` - Delete erroneous communication event

### Bulk Operations (3 endpoints)
7. POST `/transcriptions/batch-retry` - Batch retry failed transcriptions
8. POST `/communication-events/batch-resend` - Batch resend failed events
9. POST `/webhook-events/batch-retry` - Batch retry failed webhook events

---

## Pages to Build

### Page 1: Alert Management Dashboard

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/alerts/page.tsx`

**Features**:
- View all system alerts with severity levels
- Filter by: severity, acknowledged status, type, date range
- Acknowledge individual alerts with comments
- Resolve alerts with resolution notes
- Bulk acknowledge related alerts
- View alert history and timeline

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ System Alerts                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Summary Cards]                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Critical │  │ High     │  │ Unack.   │            │
│  │    3     │  │    7     │  │   12     │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                          │
│ [Filters & Actions]                                     │
│  [Severity▾] [Status▾] [Type▾] [Date Range▾]          │
│  ☐ Select All  [Bulk Acknowledge Selected]             │
│                                                          │
│ [Alerts Table]                                          │
│  ☐ │ Severity │ Type         │ Message      │ Actions │
│  ☐ │ CRITICAL │ Health Check │ Twilio API...│ [...]   │
│  ☐ │ HIGH     │ Failed Trans │ Provider ...│ [...]   │
│  ☑ │ MEDIUM   │ Quota Alert  │ Usage 90%...│ [...]   │
│                                                          │
│  [Pagination: ← 1 2 3 →]                               │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **AlertCard.tsx**
```typescript
interface AlertCardProps {
  alert: SystemAlert;
  onAcknowledge: (id: string, comment?: string) => void;
  onResolve: (id: string, resolution: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  selected?: boolean;
}

export function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onSelect,
  selected = false
}: AlertCardProps) {
  const [showAckModal, setShowAckModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  return (
    <>
      <Card className={`border-l-4 ${getSeverityBorderColor(alert.severity)}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 flex gap-3">
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onSelect(alert.id, checked as boolean)}
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getSeverityVariant(alert.severity)}>
                    {alert.severity}
                  </Badge>
                  <Badge variant="outline">{formatAlertType(alert.type)}</Badge>
                  {alert.acknowledged && (
                    <Badge variant="secondary">Acknowledged</Badge>
                  )}
                  {alert.resolved && (
                    <Badge variant="success">Resolved</Badge>
                  )}
                </div>
                <h4 className="font-medium">{alert.message}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(alert.created_at))} ago
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        {(alert.details || alert.acknowledged_by || alert.resolved_by) && (
          <CardContent className="space-y-2 text-sm">
            {alert.details && (
              <div>
                <p className="text-muted-foreground">Details:</p>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(alert.details, null, 2)}
                </pre>
              </div>
            )}

            {alert.acknowledged_by && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                <p className="text-xs font-medium">Acknowledged</p>
                <p className="text-xs">
                  By: {alert.acknowledged_by.name} ({formatDistanceToNow(new Date(alert.acknowledged_at!))} ago)
                </p>
                {alert.comment && <p className="text-xs mt-1">{alert.comment}</p>}
              </div>
            )}

            {alert.resolved_by && (
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                <p className="text-xs font-medium">Resolved</p>
                <p className="text-xs">
                  By: {alert.resolved_by.name} ({formatDistanceToNow(new Date(alert.resolved_at!))} ago)
                </p>
                {alert.resolution && <p className="text-xs mt-1">{alert.resolution}</p>}
              </div>
            )}
          </CardContent>
        )}

        <CardFooter className="flex gap-2">
          {!alert.acknowledged && (
            <Button
              onClick={() => setShowAckModal(true)}
              variant="outline"
              size="sm"
            >
              Acknowledge
            </Button>
          )}
          {!alert.resolved && (
            <Button
              onClick={() => setShowResolveModal(true)}
              variant="default"
              size="sm"
            >
              Resolve
            </Button>
          )}
        </CardFooter>
      </Card>

      <AcknowledgeAlertModal
        open={showAckModal}
        onClose={() => setShowAckModal(false)}
        alert={alert}
        onAcknowledge={onAcknowledge}
      />

      <ResolveAlertModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        alert={alert}
        onResolve={onResolve}
      />
    </>
  );
}

function getSeverityBorderColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'border-l-red-600';
    case 'HIGH': return 'border-l-orange-500';
    case 'MEDIUM': return 'border-l-yellow-500';
    case 'LOW': return 'border-l-blue-500';
    default: return 'border-l-gray-400';
  }
}

function getSeverityVariant(severity: string): "destructive" | "warning" | "default" {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'warning';
    default:
      return 'default';
  }
}

function formatAlertType(type: string): string {
  return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
```

2. **AcknowledgeAlertModal.tsx**
```typescript
interface AcknowledgeAlertModalProps {
  open: boolean;
  onClose: () => void;
  alert: SystemAlert;
  onAcknowledge: (id: string, comment?: string) => void;
}

export function AcknowledgeAlertModal({
  open,
  onClose,
  alert,
  onAcknowledge
}: AcknowledgeAlertModalProps) {
  const [comment, setComment] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await onAcknowledge(alert.id, comment || undefined);
      onClose();
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Acknowledge Alert">
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <Badge variant={getSeverityVariant(alert.severity)} className="mb-2">
            {alert.severity}
          </Badge>
          <p className="font-medium">{alert.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Created {formatDistanceToNow(new Date(alert.created_at))} ago
          </p>
        </div>

        <div>
          <Label htmlFor="comment">Comment (Optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment about this alert (e.g., 'Investigating with dev team')"
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your comment will be visible to other admins in the alert history
          </p>
        </div>

        <Alert>
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Acknowledging an alert marks it as reviewed but does not resolve it.
            You can resolve it later once the issue is fixed.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={acknowledging}>
            Cancel
          </Button>
          <Button onClick={handleAcknowledge} disabled={acknowledging}>
            {acknowledging ? "Acknowledging..." : "Acknowledge Alert"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

3. **ResolveAlertModal.tsx**
```typescript
interface ResolveAlertModalProps {
  open: boolean;
  onClose: () => void;
  alert: SystemAlert;
  onResolve: (id: string, resolution: string) => void;
}

export function ResolveAlertModal({
  open,
  onClose,
  alert,
  onResolve
}: ResolveAlertModalProps) {
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!resolution.trim()) return;

    setResolving(true);
    try {
      await onResolve(alert.id, resolution);
      onClose();
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Resolve Alert">
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <Badge variant={getSeverityVariant(alert.severity)} className="mb-2">
            {alert.severity}
          </Badge>
          <p className="font-medium">{alert.message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Created {formatDistanceToNow(new Date(alert.created_at))} ago
          </p>
        </div>

        <div>
          <Label htmlFor="resolution">Resolution Notes *</Label>
          <Textarea
            id="resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe how the issue was resolved (e.g., 'Restarted webhook processor service. Issue was caused by memory leak.')"
            rows={5}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Required - document how this issue was fixed for future reference
          </p>
        </div>

        <Alert variant="success">
          <AlertTitle>Resolving Alert</AlertTitle>
          <AlertDescription>
            This will mark the alert as resolved and close it. The alert and your resolution
            notes will be saved in the history for auditing.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={resolving}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={resolving || !resolution.trim()}>
            {resolving ? "Resolving..." : "Resolve Alert"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

4. **BulkAcknowledgeAlertsModal.tsx**
```typescript
interface BulkAcknowledgeAlertsModalProps {
  open: boolean;
  onClose: () => void;
  selectedAlertIds: string[];
  onBulkAcknowledge: (alertIds: string[], comment?: string) => Promise<void>;
}

export function BulkAcknowledgeAlertsModal({
  open,
  onClose,
  selectedAlertIds,
  onBulkAcknowledge
}: BulkAcknowledgeAlertsModalProps) {
  const [comment, setComment] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await onBulkAcknowledge(selectedAlertIds, comment || undefined);
      onClose();
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Acknowledge Alerts">
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Bulk Action</AlertTitle>
          <AlertDescription>
            You are about to acknowledge {selectedAlertIds.length} alert(s) with the same comment.
          </AlertDescription>
        </Alert>

        <div>
          <Label htmlFor="bulkComment">Comment (Optional)</Label>
          <Textarea
            id="bulkComment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment for all selected alerts (e.g., 'All related to same Twilio outage')"
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={acknowledging}>
            Cancel
          </Button>
          <Button onClick={handleAcknowledge} disabled={acknowledging}>
            {acknowledging ? "Acknowledging..." : `Acknowledge ${selectedAlertIds.length} Alert(s)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

### Page 2: Communication Events Management

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/events/page.tsx`

**Features**:
- View all communication events (SMS, email, WhatsApp) across tenants
- Filter by: channel, status, tenant, date range
- Resend failed messages (individual retry)
- Update message status manually (for stuck messages)
- Delete erroneous events with audit trail
- Bulk operations for efficiency

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Communication Events Management                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Filters]                                               │
│  [Channel▾] [Status▾] [Tenant▾] [Date Range▾]         │
│                                                          │
│ [Events Table]                                          │
│  │ Channel  │ Status  │ To/From      │ Tenant │ Actions│
│  │ SMS      │ Failed  │ +1555...     │ Acme   │ [...]  │
│  │ Email    │ Bounced │ user@...     │ Globex │ [...]  │
│  │ WhatsApp │ Sent    │ +1555...     │ XYZ    │ [...]  │
│                                                          │
│  [Pagination]                                           │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **CommunicationEventCard.tsx**
2. **ResendEventModal.tsx**
3. **UpdateEventStatusModal.tsx**
4. **DeleteEventModal.tsx**

(Similar structure to Alert components - omitted for brevity)

---

### Page 3: Bulk Operations Dashboard

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/bulk-operations/page.tsx`

**Features**:
- Batch retry failed transcriptions
- Batch resend failed communication events
- Batch retry failed webhook events
- Filter options for each bulk operation
- Progress tracking and results
- CSV export of results

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Bulk Operations                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Operation Type Selector]                               │
│  ( ) Retry Failed Transcriptions                        │
│  ( ) Resend Failed Messages                             │
│  ( ) Retry Failed Webhooks                              │
│                                                          │
│ [Filters for Selected Operation]                        │
│  Tenant: [Select Tenant ▾]                              │
│  Date Range: [From: ___] [To: ___]                     │
│  Limit: [100 ▾] (max 1000)                             │
│                                                          │
│ [Preview Results]                                       │
│  Matching Records: 78                                   │
│  Estimated Processing Time: ~2 minutes                  │
│                                                          │
│  [Execute Bulk Operation]                               │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **BulkOperationSelector.tsx**
2. **BulkRetryTranscriptionsForm.tsx**
3. **BulkResendEventsForm.tsx**
4. **BulkRetryWebhooksForm.tsx**
5. **BulkOperationProgress.tsx**

---

## API Client Implementation

**File**: `/app/src/lib/api/twilio-admin.ts` (extend existing)

```typescript
// ============================================================================
// ALERT MANAGEMENT (Sprint 8)
// ============================================================================

export async function acknowledgeAlert(id: string, comment?: string): Promise<SystemAlert> {
  const { data } = await apiClient.patch(`/admin/communication/alerts/${id}/acknowledge`, {
    comment
  });
  return data;
}

export async function resolveAlert(id: string, resolution: string): Promise<SystemAlert> {
  const { data } = await apiClient.patch(`/admin/communication/alerts/${id}/resolve`, {
    resolution
  });
  return data;
}

export async function bulkAcknowledgeAlerts(alertIds: string[], comment?: string): Promise<BulkAcknowledgeResponse> {
  const { data } = await apiClient.post('/admin/communication/alerts/bulk-acknowledge', {
    alert_ids: alertIds,
    comment
  });
  return data;
}

// ============================================================================
// COMMUNICATION EVENT MANAGEMENT (Sprint 8)
// ============================================================================

export async function resendCommunicationEvent(id: string): Promise<ResendEventResponse> {
  const { data } = await apiClient.post(`/admin/communication/communication-events/${id}/resend`);
  return data;
}

export async function updateCommunicationEventStatus(
  id: string,
  status: string,
  reason: string
): Promise<UpdateEventStatusResponse> {
  const { data } = await apiClient.patch(`/admin/communication/communication-events/${id}/status`, {
    status,
    reason
  });
  return data;
}

export async function deleteCommunicationEvent(
  id: string,
  reason: string,
  force?: boolean
): Promise<DeleteEventResponse> {
  const { data } = await apiClient.delete(`/admin/communication/communication-events/${id}`, {
    data: { reason, force }
  });
  return data;
}

// ============================================================================
// BULK OPERATIONS (Sprint 8)
// ============================================================================

export async function batchRetryTranscriptions(filters: BatchRetryTranscriptionsDto): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/transcriptions/batch-retry', filters);
  return data;
}

export async function batchResendCommunicationEvents(filters: BatchResendCommunicationEventsDto): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/communication-events/batch-resend', filters);
  return data;
}

export async function batchRetryWebhookEvents(filters: BatchRetryWebhookEventsDto): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/webhook-events/batch-retry', filters);
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts` (extend existing)

```typescript
// ============================================================================
// ALERT MANAGEMENT TYPES
// ============================================================================

export interface BulkAcknowledgeResponse {
  success: boolean;
  message: string;
  acknowledged_count: number;
  alert_ids: string[];
  acknowledged_at: string;
}

// ============================================================================
// COMMUNICATION EVENT MANAGEMENT TYPES
// ============================================================================

export interface ResendEventResponse {
  success: boolean;
  message: string;
  event_id: string;
  channel: string;
  status: string;
  queued_at: string;
}

export interface UpdateEventStatusResponse {
  id: string;
  channel: string;
  old_status: string;
  new_status: string;
  reason: string;
  updated_by: {
    id: string;
    name: string;
  };
  updated_at: string;
}

export interface DeleteEventResponse {
  success: boolean;
  message: string;
  event_id: string;
  channel: string;
  reason: string;
  deleted_by: {
    id: string;
    name: string;
  };
  deleted_at: string;
}

// ============================================================================
// BULK OPERATIONS TYPES
// ============================================================================

export interface BatchRetryTranscriptionsDto {
  tenant_id?: string;
  provider_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BatchResendCommunicationEventsDto {
  tenant_id?: string;
  channel?: 'email' | 'sms' | 'whatsapp';
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BatchRetryWebhookEventsDto {
  tenant_id?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BulkOperationResponse {
  success: boolean;
  message: string;
  queued_count: number;
  filters_applied: {
    tenant_id?: string;
    channel?: string;
    provider_id?: string;
    event_type?: string;
    date_range?: {
      start: string;
      end: string;
    };
  };
  queued_at: string;
}
```

---

## Navigation Updates

Update existing "Alerts" link in sidebar to point to new dedicated page:
- "System Alerts" → `/admin/communications/twilio/alerts`

Add new pages:
- "Communication Events" → `/admin/communications/twilio/events`
- "Bulk Operations" → `/admin/communications/twilio/bulk-operations`

---

## Acceptance Criteria

### Alert Management
- [ ] Can view all system alerts with severity badges
- [ ] Can filter alerts by severity, status, type, date range
- [ ] Can acknowledge individual alerts with optional comment
- [ ] Can resolve alerts with required resolution notes
- [ ] Can bulk acknowledge multiple selected alerts
- [ ] Alert cards show color-coded severity borders
- [ ] Acknowledged/resolved status visible on alert cards
- [ ] Alert history shows who acknowledged/resolved and when
- [ ] Cannot resolve alert without providing resolution notes
- [ ] Summary cards show counts by severity and acknowledgement status

### Communication Event Management
- [ ] Can view all communication events across channels
- [ ] Can filter by channel (SMS, email, WhatsApp), status, tenant
- [ ] Can resend individual failed messages
- [ ] Can manually update message status with audit reason
- [ ] Can delete erroneous events with required reason
- [ ] Safety checks prevent deleting delivered messages without force flag
- [ ] All operations require confirmation modals
- [ ] Event details show full message content and metadata
- [ ] Audit trail captured for all status updates and deletions

### Bulk Operations
- [ ] Can select operation type (transcriptions, events, webhooks)
- [ ] Appropriate filters shown for each operation type
- [ ] Preview shows count of matching records
- [ ] Limit enforced (max 1000 records per batch)
- [ ] Operation queued successfully with confirmation
- [ ] Results show queued count and filters applied
- [ ] Date range filters work correctly
- [ ] Tenant filter shows searchable dropdown
- [ ] Progress indication during bulk operation

### General
- [ ] All pages mobile-responsive (375px tested)
- [ ] Dark mode support on all pages
- [ ] Navigation menu updated with new pages
- [ ] No hardcoded values (uses environment variables)
- [ ] All errors handled gracefully with modals
- [ ] Loading states on all async operations
- [ ] Confirmation required for all destructive actions

---

## Testing Checklist

### Alert Management
```bash
# Acknowledge alert
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Investigating with dev team"}' \
  https://api.lead360.app/api/v1/admin/communication/alerts/{alert-id}/acknowledge

# Resolve alert
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Issue resolved by restarting service"}' \
  https://api.lead360.app/api/v1/admin/communication/alerts/{alert-id}/resolve

# Bulk acknowledge
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alert_ids":["id1","id2","id3"],"comment":"All related to same outage"}' \
  https://api.lead360.app/api/v1/admin/communication/alerts/bulk-acknowledge
```

### Communication Event Management
```bash
# Resend failed event
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/communication-events/{event-id}/resend

# Update event status
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"delivered","reason":"Webhook missed, manually confirmed"}' \
  https://api.lead360.app/api/v1/admin/communication/communication-events/{event-id}/status

# Delete event
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test message sent to production","force":false}' \
  https://api.lead360.app/api/v1/admin/communication/communication-events/{event-id}
```

### Bulk Operations
```bash
# Batch retry transcriptions
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"tenant-uuid","start_date":"2026-01-01","limit":100}' \
  https://api.lead360.app/api/v1/admin/communication/transcriptions/batch-retry

# Batch resend events
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"sms","start_date":"2026-01-01","limit":100}' \
  https://api.lead360.app/api/v1/admin/communication/communication-events/batch-resend

# Batch retry webhooks
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"sms","start_date":"2026-01-01","limit":100}' \
  https://api.lead360.app/api/v1/admin/communication/webhook-events/batch-retry
```

---

## Sprint 8 Summary

**Endpoints Implemented**: 9
- Alert Management: 3 endpoints
- Communication Event Management: 3 endpoints
- Bulk Operations: 3 endpoints

**Pages Created**: 3
- System Alerts Dashboard
- Communication Events Management
- Bulk Operations Dashboard

**Components Created**: 12+
- AlertCard
- AcknowledgeAlertModal
- ResolveAlertModal
- BulkAcknowledgeAlertsModal
- CommunicationEventCard
- ResendEventModal
- UpdateEventStatusModal
- DeleteEventModal
- BulkOperationSelector
- BulkRetryTranscriptionsForm
- BulkResendEventsForm
- BulkRetryWebhooksForm

**API Client Functions**: 9 new functions
**TypeScript Interfaces**: 10+ new interfaces

---

## Final Implementation Summary (Sprints 6-8)

**Total New Endpoints**: 30
- Sprint 6: 10 endpoints (Webhook & Phone Management)
- Sprint 7: 11 endpoints (Provider & Tenant Management)
- Sprint 8: 9 endpoints (Operations & Maintenance)

**Total Coverage**: 62 endpoints (100%)
- Original Sprints 1-5: 32 endpoints
- New Sprints 6-8: 30 endpoints

**Complete Admin Feature Set**:
✅ Provider Management (6 endpoints)
✅ Cross-Tenant Oversight (6 endpoints)
✅ Usage Tracking & Billing (7 endpoints)
✅ Transcription Monitoring (4 endpoints)
✅ System Health (6 endpoints)
✅ Metrics & Analytics (2 endpoints)
✅ Cron Management (2 endpoints)
✅ Webhook Management (5 endpoints)
✅ Phone Number Operations (5 endpoints)
✅ Transcription Provider CRUD (5 endpoints)
✅ Tenant Assistance (6 endpoints)
✅ Alert Management (3 endpoints)
✅ Communication Event Management (3 endpoints)
✅ Bulk Operations (3 endpoints)

**Production-Ready Features**:
- Modern, beautiful UI (not MVP)
- Modal-based user feedback (no system prompts)
- Mobile-responsive (375px tested)
- Dark mode support
- Comprehensive error handling
- Loading states on all async operations
- No hardcoded values
- Complete TypeScript type safety
- Proper navigation and breadcrumbs

**Ready for Production** 🎯
