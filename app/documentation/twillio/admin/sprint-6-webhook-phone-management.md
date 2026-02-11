# Sprint 6: Webhook & Phone Number Management

**Agent Role**: Senior Infrastructure & Configuration Specialist
**Expertise**: Webhook systems, telephony operations, infrastructure management
**Duration**: Complete implementation of 10 endpoints

---

## Sprint Goal

Implement complete webhook configuration and phone number lifecycle management, giving admins full control over:
- Webhook endpoints, security, and event tracking
- Phone number purchasing, allocation, and release
- Phone number inventory management

---

## Endpoints to Implement (10 Total)

### Webhook Management (5 endpoints)
1. GET `/webhooks/config` - Get webhook configuration
2. PATCH `/webhooks/config` - Update webhook configuration
3. POST `/webhooks/test` - Test webhook endpoint
4. GET `/webhook-events` - List webhook events
5. POST `/webhook-events/:id/retry` - Retry failed webhook event

### Phone Number Operations (4 endpoints)
6. POST `/phone-numbers/purchase` - Purchase new Twilio phone number
7. POST `/phone-numbers/:sid/allocate` - Allocate phone number to tenant
8. DELETE `/phone-numbers/:sid/allocate` - Deallocate phone number from tenant
9. DELETE `/phone-numbers/:sid` - Release phone number to Twilio

### Phone Number Inventory (1 endpoint)
10. GET `/twilio/phone-numbers` - List owned phone numbers (missed in Sprint 1)

---

## Pages to Build

### Page 1: Webhook Configuration

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/webhooks/page.tsx`

**Features**:
- View current webhook configuration (base URL, endpoints, security)
- Update webhook base URL
- Rotate webhook secret
- Toggle signature verification
- Test webhook endpoints
- View recent webhook events with status
- Retry failed webhook events

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Webhook Configuration                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Current Configuration Card]                            │
│  Base URL: https://api.lead360.app                     │
│  Signature Verification: ✓ Enabled                     │
│  Secret Status: ✓ Configured (Last rotated: 2d ago)   │
│  [Edit Configuration] [Rotate Secret] [Test Webhooks] │
│                                                          │
│ [Webhook Endpoints Card]                                │
│  SMS:      /webhooks/twilio/sms       [Test]          │
│  Calls:    /webhooks/twilio/calls     [Test]          │
│  WhatsApp: /webhooks/twilio/whatsapp  [Test]          │
│  Email:    /webhooks/sendgrid/email   [Test]          │
│                                                          │
│ [Recent Webhook Events Table]                           │
│  │ Type     │ Status    │ Received       │ Actions    │
│  │ SMS      │ Processed │ 2 mins ago     │ [View]     │
│  │ Call     │ Failed    │ 15 mins ago    │ [Retry]    │
│  │ WhatsApp │ Processed │ 1 hour ago     │ [View]     │
│                                                          │
│  [View All Events →]                                    │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **WebhookConfigCard.tsx**
```typescript
interface WebhookConfigCardProps {
  config: WebhookConfig;
  onEdit: () => void;
  onRotateSecret: () => void;
  onTest: () => void;
}

export function WebhookConfigCard({
  config,
  onEdit,
  onRotateSecret,
  onTest
}: WebhookConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Base URL</Label>
            <p className="text-sm font-mono">{config.base_url}</p>
          </div>
          <div>
            <Label>Signature Verification</Label>
            <Badge variant={config.signature_verification ? "success" : "destructive"}>
              {config.signature_verification ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div>
            <Label>Secret Status</Label>
            <p className="text-sm">
              {config.secret_configured ? "✓ Configured" : "⚠ Not configured"}
            </p>
            {config.last_rotated && (
              <p className="text-xs text-muted-foreground">
                Last rotated: {formatDistanceToNow(new Date(config.last_rotated))} ago
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline" size="sm">
            Edit Configuration
          </Button>
          <Button onClick={onRotateSecret} variant="outline" size="sm">
            Rotate Secret
          </Button>
          <Button onClick={onTest} variant="default" size="sm">
            Test Webhooks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

2. **WebhookEndpointsCard.tsx**
```typescript
interface WebhookEndpointsCardProps {
  baseUrl: string;
  endpoints: Record<string, string>;
  onTest: (type: string) => void;
}

export function WebhookEndpointsCard({
  baseUrl,
  endpoints,
  onTest
}: WebhookEndpointsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Endpoints</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(endpoints).map(([type, path]) => (
            <div key={type} className="flex items-center justify-between p-3 border rounded">
              <div className="flex-1">
                <p className="font-medium capitalize">{type}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {baseUrl}{path}
                </p>
              </div>
              <Button
                onClick={() => onTest(type)}
                variant="outline"
                size="sm"
              >
                Test
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

3. **EditWebhookConfigModal.tsx**
```typescript
interface EditWebhookConfigModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: WebhookConfig;
  onSave: (data: UpdateWebhookConfigDto) => Promise<void>;
}

export function EditWebhookConfigModal({
  open,
  onClose,
  currentConfig,
  onSave
}: EditWebhookConfigModalProps) {
  const [baseUrl, setBaseUrl] = useState(currentConfig.base_url);
  const [signatureVerification, setSignatureVerification] = useState(currentConfig.signature_verification);
  const [rotateSecret, setRotateSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        base_url: baseUrl,
        signature_verification: signatureVerification,
        rotate_secret: rotateSecret
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Webhook Configuration">
      <div className="space-y-4">
        <div>
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.lead360.app"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Base URL for all webhook endpoints
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Signature Verification</Label>
            <p className="text-xs text-muted-foreground">
              Verify webhook signatures for security
            </p>
          </div>
          <Switch
            checked={signatureVerification}
            onCheckedChange={setSignatureVerification}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Rotate Webhook Secret</Label>
            <p className="text-xs text-muted-foreground">
              Generate new webhook secret (invalidates old secret)
            </p>
          </div>
          <Switch
            checked={rotateSecret}
            onCheckedChange={setRotateSecret}
          />
        </div>

        {rotateSecret && (
          <Alert variant="warning">
            <AlertTitle>Warning: Secret Rotation</AlertTitle>
            <AlertDescription>
              Rotating the webhook secret will invalidate the old secret. Ensure you update
              all webhook configurations in Twilio with the new secret.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

4. **WebhookEventsTable.tsx**
```typescript
interface WebhookEventsTableProps {
  events: WebhookEvent[];
  onRetry: (id: string) => void;
  onViewDetails: (id: string) => void;
  loading?: boolean;
}

export function WebhookEventsTable({
  events,
  onRetry,
  onViewDetails,
  loading = false
}: WebhookEventsTableProps) {
  if (loading) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No webhook events yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="capitalize">{event.webhook_type}</TableCell>
            <TableCell>
              <Badge variant={getStatusVariant(event.status)}>
                {event.status}
              </Badge>
            </TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(event.created_at))} ago
            </TableCell>
            <TableCell>{event.processing_attempts}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  onClick={() => onViewDetails(event.id)}
                  variant="ghost"
                  size="sm"
                >
                  View
                </Button>
                {event.status === 'failed' && (
                  <Button
                    onClick={() => onRetry(event.id)}
                    variant="outline"
                    size="sm"
                  >
                    Retry
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function getStatusVariant(status: string): "success" | "warning" | "destructive" {
  switch (status) {
    case 'processed': return 'success';
    case 'pending': return 'warning';
    case 'failed': return 'destructive';
    default: return 'warning';
  }
}
```

---

### Page 2: Webhook Events List

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/webhooks/events/page.tsx`

**Features**:
- Paginated list of all webhook events
- Filter by: type, status, date range
- View event details (payload, response, errors)
- Retry failed events (individual and bulk)
- Search by webhook type or status

**UI Components**:
- WebhookEventsFilters (type, status, date range)
- WebhookEventsTable (with pagination)
- WebhookEventDetailModal (shows full payload and response)
- Bulk retry selection

---

### Page 3: Phone Number Management

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/phone-numbers/page.tsx`

**Features**:
- View all owned phone numbers
- Show allocation status (available vs allocated)
- Purchase new phone numbers
- Allocate numbers to tenants
- Deallocate numbers from tenants
- Release numbers back to Twilio
- Search/filter by number, status, tenant

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Phone Number Management                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Summary Cards Row]                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Total    │  │ Allocated│  │ Available│            │
│  │   15     │  │     8    │  │     7    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                          │
│ [Actions & Filters]                                     │
│  [Purchase New Number]  [Search] [Status▾] [Tenant▾]  │
│                                                          │
│ [Phone Numbers Table]                                   │
│  │ Number          │ Status    │ Allocated To  │ Actions│
│  │ +1 (555) 123-456│ Allocated │ Acme Corp     │ [...]  │
│  │ +1 (555) 789-012│ Available │ —             │ [...]  │
│  │ +1 (555) 345-678│ Allocated │ Globex Inc    │ [...]  │
│                                                          │
│  [Pagination: ← 1 2 3 4 5 →]                           │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **PhoneNumberCard.tsx**
```typescript
interface PhoneNumberCardProps {
  number: PhoneNumber;
  onAllocate: (sid: string) => void;
  onDeallocate: (sid: string) => void;
  onRelease: (sid: string) => void;
}

export function PhoneNumberCard({
  number,
  onAllocate,
  onDeallocate,
  onRelease
}: PhoneNumberCardProps) {
  const isAllocated = number.status === 'allocated';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{number.friendly_name}</h3>
            <p className="text-sm text-muted-foreground font-mono">{number.phone_number}</p>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={isAllocated ? "default" : "secondary"}>
                  {number.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  SID: {number.sid.substring(0, 10)}...
                </span>
              </div>

              {isAllocated && number.allocated_to && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Allocated to:</p>
                  <p className="font-medium">{number.allocated_to.tenant_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {number.allocated_to.config_type}
                  </p>
                </div>
              )}

              <div className="flex gap-1 text-xs">
                {number.capabilities.voice && <Badge variant="outline">Voice</Badge>}
                {number.capabilities.sms && <Badge variant="outline">SMS</Badge>}
                {number.capabilities.mms && <Badge variant="outline">MMS</Badge>}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isAllocated && (
                <DropdownMenuItem onClick={() => onAllocate(number.sid)}>
                  Allocate to Tenant
                </DropdownMenuItem>
              )}
              {isAllocated && (
                <DropdownMenuItem onClick={() => onDeallocate(number.sid)}>
                  Deallocate from Tenant
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRelease(number.sid)}
                className="text-destructive"
                disabled={isAllocated}
              >
                Release Number
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
```

2. **PurchasePhoneNumberModal.tsx**
```typescript
interface PurchasePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  onPurchase: (data: PurchasePhoneNumberDto) => Promise<void>;
  tenants: Tenant[];
}

export function PurchasePhoneNumberModal({
  open,
  onClose,
  onPurchase,
  tenants
}: PurchasePhoneNumberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [purpose, setPurpose] = useState<'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp'>('SMS + Calls');
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await onPurchase({
        phone_number: phoneNumber,
        tenant_id: tenantId || undefined,
        purpose
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Purchase Phone Number">
      <div className="space-y-4">
        <div>
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15555555555"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the phone number you want to purchase (E.164 format)
          </p>
        </div>

        <div>
          <Label htmlFor="tenant">Allocate to Tenant (Optional)</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Select tenant or leave unallocated" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (Keep Available)</SelectItem>
              {tenants.map(tenant => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tenantId && (
          <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMS Only">SMS Only</SelectItem>
                <SelectItem value="Calls Only">Calls Only</SelectItem>
                <SelectItem value="SMS + Calls">SMS + Calls</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Alert>
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Purchasing a number will charge your Twilio account. Monthly cost is typically $1.00/month.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={purchasing}>
            Cancel
          </Button>
          <Button onClick={handlePurchase} disabled={purchasing || !phoneNumber}>
            {purchasing ? "Purchasing..." : "Purchase Number"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

3. **AllocatePhoneNumberModal.tsx**
```typescript
interface AllocatePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber;
  tenants: Tenant[];
  onAllocate: (sid: string, data: AllocatePhoneNumberDto) => Promise<void>;
}

export function AllocatePhoneNumberModal({
  open,
  onClose,
  phoneNumber,
  tenants,
  onAllocate
}: AllocatePhoneNumberModalProps) {
  const [tenantId, setTenantId] = useState('');
  const [purpose, setPurpose] = useState<'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp'>('SMS + Calls');
  const [allocating, setAllocating] = useState(false);

  const handleAllocate = async () => {
    if (!tenantId) return;

    setAllocating(true);
    try {
      await onAllocate(phoneNumber.sid, {
        tenant_id: tenantId,
        purpose
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setAllocating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Allocate Phone Number">
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Phone Number</p>
          <p className="text-lg font-semibold">{phoneNumber.friendly_name}</p>
          <p className="text-xs text-muted-foreground">{phoneNumber.phone_number}</p>
        </div>

        <div>
          <Label htmlFor="tenant">Select Tenant</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(tenant => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="purpose">Purpose</Label>
          <Select value={purpose} onValueChange={(v) => setPurpose(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SMS Only">SMS Only</SelectItem>
              <SelectItem value="Calls Only">Calls Only</SelectItem>
              <SelectItem value="SMS + Calls">SMS + Calls</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={allocating}>
            Cancel
          </Button>
          <Button onClick={handleAllocate} disabled={allocating || !tenantId}>
            {allocating ? "Allocating..." : "Allocate Number"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

4. **DeallocatePhoneNumberModal.tsx**
```typescript
interface DeallocatePhoneNumberModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: PhoneNumber;
  onDeallocate: (sid: string, data: DeallocatePhoneNumberDto) => Promise<void>;
}

export function DeallocatePhoneNumberModal({
  open,
  onClose,
  phoneNumber,
  onDeallocate
}: DeallocatePhoneNumberModalProps) {
  const [deleteConfig, setDeleteConfig] = useState(false);
  const [reason, setReason] = useState('');
  const [deallocating, setDeallocating] = useState(false);

  const handleDeallocate = async () => {
    setDeallocating(true);
    try {
      await onDeallocate(phoneNumber.sid, {
        delete_config: deleteConfig,
        reason: reason || undefined
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setDeallocating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Deallocate Phone Number">
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTitle>Deallocate Number</AlertTitle>
          <AlertDescription>
            This will remove the number from {phoneNumber.allocated_to?.tenant_name} and
            make it available for reallocation.
          </AlertDescription>
        </Alert>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Phone Number</p>
          <p className="text-lg font-semibold">{phoneNumber.friendly_name}</p>
          <p className="text-xs text-muted-foreground">
            Currently allocated to: {phoneNumber.allocated_to?.tenant_name}
          </p>
        </div>

        <div>
          <Label htmlFor="reason">Reason (Optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for deallocation (for audit log)"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Also Delete Tenant Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Remove the SMS/WhatsApp config that uses this number
            </p>
          </div>
          <Switch
            checked={deleteConfig}
            onCheckedChange={setDeleteConfig}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={deallocating}>
            Cancel
          </Button>
          <Button onClick={handleDeallocate} variant="destructive" disabled={deallocating}>
            {deallocating ? "Deallocating..." : "Deallocate Number"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

## API Client Implementation

**File**: `/app/src/lib/api/twilio-admin.ts` (extend existing)

```typescript
// ============================================================================
// WEBHOOK MANAGEMENT (Sprint 6)
// ============================================================================

export async function getWebhookConfig(): Promise<WebhookConfig> {
  const { data } = await apiClient.get('/admin/communication/webhooks/config');
  return data;
}

export async function updateWebhookConfig(dto: UpdateWebhookConfigDto): Promise<WebhookConfigUpdateResponse> {
  const { data } = await apiClient.patch('/admin/communication/webhooks/config', dto);
  return data;
}

export async function testWebhookEndpoint(dto: TestWebhookDto): Promise<WebhookTestResult> {
  const { data } = await apiClient.post('/admin/communication/webhooks/test', dto);
  return data;
}

export async function getWebhookEvents(filters?: WebhookEventFilters): Promise<PaginatedResponse<WebhookEvent>> {
  const { data } = await apiClient.get('/admin/communication/webhook-events', { params: filters });
  return data;
}

export async function retryWebhookEvent(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.post(`/admin/communication/webhook-events/${id}/retry`);
  return data;
}

// ============================================================================
// PHONE NUMBER OPERATIONS (Sprint 6)
// ============================================================================

export async function purchasePhoneNumber(dto: PurchasePhoneNumberDto): Promise<PhoneNumberPurchaseResponse> {
  const { data } = await apiClient.post('/admin/communication/phone-numbers/purchase', dto);
  return data;
}

export async function allocatePhoneNumber(sid: string, dto: AllocatePhoneNumberDto): Promise<PhoneNumberAllocationResponse> {
  const { data } = await apiClient.post(`/admin/communication/phone-numbers/${sid}/allocate`, dto);
  return data;
}

export async function deallocatePhoneNumber(sid: string, dto: DeallocatePhoneNumberDto): Promise<PhoneNumberDeallocationResponse> {
  const { data } = await apiClient.delete(`/admin/communication/phone-numbers/${sid}/allocate`, { data: dto });
  return data;
}

export async function releasePhoneNumber(sid: string): Promise<PhoneNumberReleaseResponse> {
  const { data } = await apiClient.delete(`/admin/communication/phone-numbers/${sid}`);
  return data;
}

export async function getOwnedPhoneNumbers(): Promise<OwnedPhoneNumbersResponse> {
  const { data } = await apiClient.get('/admin/communication/twilio/phone-numbers');
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts` (extend existing)

```typescript
// ============================================================================
// WEBHOOK MANAGEMENT TYPES
// ============================================================================

export interface WebhookConfig {
  base_url: string;
  endpoints: {
    sms: string;
    call: string;
    whatsapp: string;
    email: string;
  };
  signature_verification: boolean;
  secret_configured: boolean;
  last_updated?: string;
}

export interface UpdateWebhookConfigDto {
  base_url?: string;
  signature_verification?: boolean;
  rotate_secret?: boolean;
}

export interface WebhookConfigUpdateResponse {
  success: boolean;
  message: string;
  config: WebhookConfig;
}

export interface TestWebhookDto {
  type: 'sms' | 'call' | 'whatsapp' | 'email';
  payload?: Record<string, any>;
}

export interface WebhookTestResult {
  success: boolean;
  message: string;
  type: string;
  endpoint: string;
  response_time_ms?: number;
  webhook_processed?: boolean;
  error?: string;
  tested_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_type: 'sms' | 'call' | 'whatsapp' | 'email';
  status: 'pending' | 'processed' | 'failed';
  payload: Record<string, any>;
  processing_attempts: number;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface WebhookEventFilters {
  webhook_type?: 'sms' | 'call' | 'whatsapp' | 'email';
  status?: 'pending' | 'processed' | 'failed';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// PHONE NUMBER TYPES
// ============================================================================

export interface PhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: 'allocated' | 'available';
  allocated_to: {
    tenant_id: string;
    tenant_name: string;
    config_type: string;
    config_id: string;
  } | null;
  created_at: string;
}

export interface OwnedPhoneNumbersResponse {
  phone_numbers: PhoneNumber[];
  total_count: number;
  allocated_count: number;
  available_count: number;
}

export interface PurchasePhoneNumberDto {
  phone_number: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  tenant_id?: string;
  purpose?: 'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp';
}

export interface PhoneNumberPurchaseResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    friendly_name: string;
    capabilities: {
      voice: boolean;
      sms: boolean;
      mms: boolean;
    };
    monthly_cost: string;
  };
  allocation?: {
    tenant_id: string;
    purpose: string;
    allocated_at: string;
  };
}

export interface AllocatePhoneNumberDto {
  tenant_id: string;
  purpose?: 'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp';
}

export interface PhoneNumberAllocationResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    friendly_name: string;
  };
  allocation: {
    tenant_id: string;
    tenant_name: string;
    purpose: string;
    allocated_at: string;
  };
}

export interface DeallocatePhoneNumberDto {
  delete_config?: boolean;
  reason?: string;
}

export interface PhoneNumberDeallocationResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    status: string;
  };
  previous_allocation: {
    tenant_id: string;
    tenant_name: string;
    deallocated_at: string;
  };
  config_deleted: boolean;
}

export interface PhoneNumberReleaseResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    released_at: string;
  };
}
```

---

## Navigation Updates

**File**: `/app/src/components/dashboard/DashboardSidebar.tsx` (update)

Add new menu items under Communications > Twilio Admin:

```typescript
{
  title: "Twilio Admin",
  icon: PhoneCall,
  items: [
    { title: "Dashboard", href: "/admin/communications/twilio" },
    { title: "System Health", href: "/admin/communications/twilio/health" },
    { title: "Provider Settings", href: "/admin/communications/twilio/provider" },
    { title: "Phone Numbers", href: "/admin/communications/twilio/phone-numbers" }, // NEW
    { title: "Webhooks", href: "/admin/communications/twilio/webhooks" }, // NEW
    { title: "Calls Monitor", href: "/admin/communications/twilio/calls" },
    { title: "Messages", href: "/admin/communications/twilio/messages" },
    { title: "Tenants", href: "/admin/communications/twilio/tenants" },
    { title: "Usage & Billing", href: "/admin/communications/twilio/usage" },
    { title: "Transcriptions", href: "/admin/communications/twilio/transcriptions" },
    { title: "Metrics", href: "/admin/communications/twilio/metrics" },
    { title: "Cron Jobs", href: "/admin/communications/twilio/cron" },
  ]
}
```

---

## Acceptance Criteria

### Webhook Management
- [ ] Can view current webhook configuration with all settings
- [ ] Can edit webhook base URL
- [ ] Can toggle signature verification on/off
- [ ] Can rotate webhook secret with confirmation
- [ ] Can test each webhook endpoint type (SMS, Call, WhatsApp, Email)
- [ ] Test results show success/failure with response times
- [ ] Can view paginated list of webhook events
- [ ] Can filter webhook events by type, status, date range
- [ ] Can view full webhook event details (payload, error)
- [ ] Can retry individual failed webhook events
- [ ] Success/error feedback shown in modals
- [ ] All loading states display correctly

### Phone Number Operations
- [ ] Can view all owned phone numbers with allocation status
- [ ] Summary cards show total, allocated, and available counts
- [ ] Can purchase new phone numbers from Twilio
- [ ] Can optionally allocate number to tenant during purchase
- [ ] Can allocate available numbers to tenants with purpose selection
- [ ] Can deallocate numbers from tenants
- [ ] Can optionally delete tenant config during deallocation
- [ ] Can release deallocated numbers back to Twilio
- [ ] Cannot release allocated numbers (validation)
- [ ] Can search/filter phone numbers by status, tenant, number
- [ ] Phone number cards show capabilities (Voice, SMS, MMS)
- [ ] All operations show confirmation modals
- [ ] Success/error feedback in modals
- [ ] All loading states display correctly

### General
- [ ] All pages are mobile-responsive (tested on 375px)
- [ ] Dark mode works on all pages
- [ ] Navigation menu updated with new pages
- [ ] Breadcrumbs show correct paths
- [ ] No hardcoded API URLs (uses environment variables)
- [ ] No mock data or TODOs in production code
- [ ] All API errors handled gracefully with user-friendly messages

---

## Testing Checklist

### Webhook Configuration
```bash
# Test webhook config retrieval
curl -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/webhooks/config

# Test webhook config update
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"base_url":"https://api.lead360.app","rotate_secret":true}' \
  https://api.lead360.app/api/v1/admin/communication/webhooks/config

# Test webhook endpoint
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"sms","payload":{"from":"+15555555555","body":"Test"}}' \
  https://api.lead360.app/api/v1/admin/communication/webhooks/test

# Get webhook events
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.lead360.app/api/v1/admin/communication/webhook-events?status=failed&limit=10"

# Retry webhook event
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/webhook-events/{event-id}/retry
```

### Phone Number Operations
```bash
# Get owned phone numbers
curl -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/twilio/phone-numbers

# Purchase phone number
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+15555555555","tenant_id":"tenant-uuid","purpose":"SMS + Calls"}' \
  https://api.lead360.app/api/v1/admin/communication/phone-numbers/purchase

# Allocate phone number
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"tenant-uuid","purpose":"SMS Only"}' \
  https://api.lead360.app/api/v1/admin/communication/phone-numbers/{sid}/allocate

# Deallocate phone number
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"delete_config":false,"reason":"Tenant request"}' \
  https://api.lead360.app/api/v1/admin/communication/phone-numbers/{sid}/allocate

# Release phone number
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/phone-numbers/{sid}
```

---

## Sprint 6 Summary

**Endpoints Implemented**: 10
- Webhook Management: 5 endpoints
- Phone Number Operations: 4 endpoints
- Phone Number Inventory: 1 endpoint

**Pages Created**: 3
- Webhooks Configuration Page
- Webhook Events List Page
- Phone Numbers Management Page

**Components Created**: 12
- WebhookConfigCard
- WebhookEndpointsCard
- EditWebhookConfigModal
- WebhookEventsTable
- PhoneNumberCard
- PurchasePhoneNumberModal
- AllocatePhoneNumberModal
- DeallocatePhoneNumberModal
- WebhookEventsFilters
- WebhookEventDetailModal
- PhoneNumberFilters
- PhoneNumbersTable

**API Client Functions**: 10 new functions
**TypeScript Interfaces**: 15+ new interfaces

**Ready for**: Sprint 7 (Provider & Tenant Management)
