# Sprint 7: Provider & Tenant Management

**Agent Role**: Senior Platform Integrations & Support Specialist
**Expertise**: Third-party API integrations, multi-tenant support, provider management
**Duration**: Complete implementation of 11 endpoints

---

## Sprint Goal

Implement complete transcription provider management and tenant assistance features, enabling admins to:
- Manage AI transcription providers (OpenAI Whisper, Deepgram, AssemblyAI)
- Create and update communication configurations on behalf of tenants
- Test and troubleshoot tenant configurations
- Provide white-glove tenant support

---

## Endpoints to Implement (11 Total)

### Transcription Provider CRUD (5 endpoints)
1. POST `/transcription-providers` - Create transcription provider
2. GET `/transcription-providers/:id` - Get transcription provider details
3. PATCH `/transcription-providers/:id` - Update transcription provider
4. DELETE `/transcription-providers/:id` - Delete transcription provider
5. POST `/transcription-providers/:id/test` - Test transcription provider connectivity

### Tenant Assistance (6 endpoints)
6. POST `/tenants/:tenantId/sms-config` - Create SMS config for tenant
7. PATCH `/tenants/:tenantId/sms-config/:configId` - Update SMS config for tenant
8. POST `/tenants/:tenantId/whatsapp-config` - Create WhatsApp config for tenant
9. PATCH `/tenants/:tenantId/whatsapp-config/:configId` - Update WhatsApp config for tenant
10. POST `/tenants/:tenantId/test-sms` - Test tenant SMS configuration
11. POST `/tenants/:tenantId/test-whatsapp` - Test tenant WhatsApp configuration

---

## Pages to Build

### Page 1: Transcription Providers Management

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/transcription-providers/page.tsx`

**Features**:
- View all configured transcription providers
- Show provider statistics (success rate, usage, costs)
- Add new transcription provider (OpenAI Whisper, Deepgram, AssemblyAI)
- Update provider configuration (API keys, settings, limits)
- Set system default provider
- Test provider connectivity
- Delete unused providers

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Transcription Providers                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Add New Provider] [Refresh Stats]                      │
│                                                          │
│ [Provider Card: OpenAI Whisper] ⭐ System Default       │
│  ┌────────────────────────────────────────────────┐    │
│  │ Status: ✓ Active                               │    │
│  │ Model: whisper-1                               │    │
│  │ Usage: 3,456 / 10,000 (34.6%)                  │    │
│  │ Success Rate: 97.74%                           │    │
│  │ Cost per minute: $0.0060                       │    │
│  │ Total Cost: $20.74                             │    │
│  │                                                 │    │
│  │ [Test] [Edit] [Make Default] [Delete]         │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│ [Provider Card: Deepgram]                               │
│  ┌────────────────────────────────────────────────┐    │
│  │ Status: ⚠ Inactive                             │    │
│  │ Model: nova-2                                  │    │
│  │ Usage: 0 / 5,000 (0%)                          │    │
│  │ Success Rate: N/A                              │    │
│  │ Cost per minute: $0.0043                       │    │
│  │                                                 │    │
│  │ [Test] [Edit] [Activate] [Delete]             │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **TranscriptionProviderCard.tsx**
```typescript
interface TranscriptionProviderCardProps {
  provider: TranscriptionProvider;
  onTest: (id: string) => void;
  onEdit: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TranscriptionProviderCard({
  provider,
  onTest,
  onEdit,
  onMakeDefault,
  onDelete
}: TranscriptionProviderCardProps) {
  const usagePercentage = (provider.usage_current / provider.usage_limit) * 100;
  const isHealthy = parseFloat(provider.statistics.success_rate) >= 95;

  return (
    <Card className={provider.is_system_default ? "border-primary" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getProviderIcon(provider.provider_name)}
              {getProviderDisplayName(provider.provider_name)}
              {provider.is_system_default && (
                <Badge variant="default">System Default</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Model: {provider.model || 'Default'}
            </p>
          </div>
          <Badge variant={provider.status === 'active' ? 'success' : 'secondary'}>
            {provider.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Usage</span>
            <span className="text-muted-foreground">
              {provider.usage_current.toLocaleString()} / {provider.usage_limit.toLocaleString()}
            </span>
          </div>
          <Progress value={usagePercentage} className={usagePercentage > 90 ? "bg-destructive" : undefined} />
          <p className="text-xs text-muted-foreground mt-1">
            {usagePercentage.toFixed(1)}% of monthly limit
          </p>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              {isHealthy ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
              {provider.statistics.success_rate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {provider.statistics.successful.toLocaleString()} / {provider.statistics.total_transcriptions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-semibold">{provider.statistics.total_cost}</p>
            <p className="text-xs text-muted-foreground">
              ${provider.cost_per_minute}/min
            </p>
          </div>
        </div>

        {/* Language & Endpoint */}
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Language:</span>
            <span>{provider.language || 'Auto-detect'}</span>
          </div>
          {provider.tenant && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tenant:</span>
              <span>{provider.tenant.company_name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={() => onTest(provider.id)} variant="outline" size="sm" className="flex-1">
            Test
          </Button>
          <Button onClick={() => onEdit(provider.id)} variant="outline" size="sm" className="flex-1">
            Edit
          </Button>
          {!provider.is_system_default && (
            <Button onClick={() => onMakeDefault(provider.id)} variant="outline" size="sm" className="flex-1">
              Make Default
            </Button>
          )}
          <Button
            onClick={() => onDelete(provider.id)}
            variant="destructive"
            size="sm"
            disabled={provider.is_system_default}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getProviderIcon(name: string) {
  switch (name) {
    case 'openai_whisper': return <Mic className="h-5 w-5" />;
    case 'deepgram': return <Radio className="h-5 w-5" />;
    case 'assemblyai': return <AudioLines className="h-5 w-5" />;
    default: return <Mic className="h-5 w-5" />;
  }
}

function getProviderDisplayName(name: string): string {
  switch (name) {
    case 'openai_whisper': return 'OpenAI Whisper';
    case 'deepgram': return 'Deepgram';
    case 'assemblyai': return 'AssemblyAI';
    default: return name;
  }
}
```

2. **AddTranscriptionProviderModal.tsx**
```typescript
interface AddTranscriptionProviderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateTranscriptionProviderDto) => Promise<void>;
  tenants: Tenant[];
}

export function AddTranscriptionProviderModal({
  open,
  onClose,
  onCreate,
  tenants
}: AddTranscriptionProviderModalProps) {
  const [providerName, setProviderName] = useState<'openai_whisper' | 'deepgram' | 'assemblyai'>('openai_whisper');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [language, setLanguage] = useState('en');
  const [costPerMinute, setCostPerMinute] = useState('0.006');
  const [usageLimit, setUsageLimit] = useState('10000');
  const [isSystemDefault, setIsSystemDefault] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate({
        provider_name: providerName,
        api_key: apiKey,
        api_endpoint: apiEndpoint || undefined,
        model: model || undefined,
        language: language || undefined,
        cost_per_minute: parseFloat(costPerMinute),
        usage_limit: parseInt(usageLimit),
        is_system_default: isSystemDefault,
        tenant_id: tenantId || undefined
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Transcription Provider" size="large">
      <div className="space-y-4">
        <div>
          <Label htmlFor="providerName">Provider</Label>
          <Select value={providerName} onValueChange={(v) => setProviderName(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai_whisper">OpenAI Whisper</SelectItem>
              <SelectItem value="deepgram">Deepgram</SelectItem>
              <SelectItem value="assemblyai">AssemblyAI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="apiKey">API Key *</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-proj-..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Will be encrypted before storage
          </p>
        </div>

        <div>
          <Label htmlFor="apiEndpoint">API Endpoint (Optional)</Label>
          <Input
            id="apiEndpoint"
            type="url"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1/audio/transcriptions"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use default endpoint
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="model">Model (Optional)</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="whisper-1"
            />
          </div>
          <div>
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="costPerMinute">Cost per Minute (USD)</Label>
            <Input
              id="costPerMinute"
              type="number"
              step="0.0001"
              value={costPerMinute}
              onChange={(e) => setCostPerMinute(e.target.value)}
              placeholder="0.006"
            />
          </div>
          <div>
            <Label htmlFor="usageLimit">Monthly Usage Limit</Label>
            <Input
              id="usageLimit"
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="10000"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tenant">Tenant (Optional)</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="System-wide (no tenant)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">System-wide</SelectItem>
              {tenants.map(tenant => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Set as System Default</Label>
            <p className="text-xs text-muted-foreground">
              This provider will be used for all new transcriptions
            </p>
          </div>
          <Switch
            checked={isSystemDefault}
            onCheckedChange={setIsSystemDefault}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !apiKey}>
            {creating ? "Creating..." : "Create Provider"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

3. **EditTranscriptionProviderModal.tsx** (similar structure to Add modal)

4. **TestTranscriptionProviderModal.tsx**
```typescript
interface TestTranscriptionProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider: TranscriptionProvider;
  onTest: (id: string, audioUrl?: string) => Promise<TestTranscriptionResult>;
}

export function TestTranscriptionProviderModal({
  open,
  onClose,
  provider,
  onTest
}: TestTranscriptionProviderModalProps) {
  const [audioUrl, setAudioUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestTranscriptionResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(provider.id, audioUrl || undefined);
      setTestResult(result);
    } catch (error) {
      // Error handled by parent
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Test Transcription Provider">
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Testing Provider</p>
          <p className="text-lg font-semibold">{getProviderDisplayName(provider.provider_name)}</p>
          <p className="text-xs text-muted-foreground">Model: {provider.model || 'Default'}</p>
        </div>

        <div>
          <Label htmlFor="audioUrl">Audio URL (Optional)</Label>
          <Input
            id="audioUrl"
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://example.com/test-audio.mp3"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to use default test file
          </p>
        </div>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {testResult.success ? "✓ Test Successful" : "✗ Test Failed"}
            </AlertTitle>
            <AlertDescription>
              {testResult.message}
              {testResult.test_transcription && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Transcription Result:</p>
                  <p className="text-sm mt-1">{testResult.test_transcription.text}</p>
                  <div className="flex gap-4 text-xs mt-2 text-muted-foreground">
                    <span>Confidence: {(testResult.test_transcription.confidence * 100).toFixed(1)}%</span>
                    <span>Duration: {testResult.test_transcription.duration_seconds}s</span>
                    <span>Processing: {testResult.test_transcription.processing_time_seconds}s</span>
                  </div>
                </div>
              )}
              {testResult.error && (
                <p className="text-sm mt-2 text-destructive">{testResult.error}</p>
              )}
              <p className="text-xs mt-2">
                Response time: {testResult.api_response_time_ms}ms
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={testing}>
            Close
          </Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? "Testing..." : "Run Test"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

---

### Page 2: Tenant Assistance Dashboard

**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/tenant-assistance/page.tsx`

**Features**:
- Search and select tenants
- View tenant's current communication configurations
- Create SMS/WhatsApp configurations on behalf of tenant
- Update existing tenant configurations
- Test tenant configurations (send test messages)
- View tenant communication statistics

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Tenant Assistance                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Tenant Selector with Search]                           │
│  🔍 Search tenants... [Select: Acme Corp ▾]            │
│                                                          │
│ [Selected Tenant Info Card]                             │
│  Company: Acme Corp                                     │
│  Subdomain: acme.lead360.app                           │
│  Total Communications: 1,234 (last 30 days)            │
│                                                          │
│ [SMS Configuration Section]                             │
│  ┌────────────────────────────────────────┐            │
│  │ ✓ Primary SMS Config                   │            │
│  │ From: +1 (555) 123-4567                │            │
│  │ Provider: System (Model B)             │            │
│  │ Status: Active                         │            │
│  │ [Test] [Edit] [Deactivate]            │            │
│  └────────────────────────────────────────┘            │
│  [+ Add SMS Configuration]                              │
│                                                          │
│ [WhatsApp Configuration Section]                        │
│  ┌────────────────────────────────────────┐            │
│  │ ✓ Primary WhatsApp Config              │            │
│  │ From: +1 (555) 789-0123                │            │
│  │ Provider: System (Model B)             │            │
│  │ Status: Active                         │            │
│  │ [Test] [Edit] [Deactivate]            │            │
│  └────────────────────────────────────────┘            │
│  [+ Add WhatsApp Configuration]                         │
└─────────────────────────────────────────────────────────┘
```

**Components to Create**:

1. **TenantSelector.tsx**
```typescript
interface TenantSelectorProps {
  tenants: Tenant[];
  selectedTenantId: string | null;
  onSelect: (tenantId: string) => void;
  loading?: boolean;
}

export function TenantSelector({
  tenants,
  selectedTenantId,
  onSelect,
  loading = false
}: TenantSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTenants = tenants.filter(t =>
    t.company_name.toLowerCase().includes(search.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Tenant</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name or subdomain..."
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex justify-center p-4"><Spinner /></div>
          ) : (
            <Select value={selectedTenantId || ''} onValueChange={onSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tenant to assist" />
              </SelectTrigger>
              <SelectContent>
                {filteredTenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    <div>
                      <p className="font-medium">{tenant.company_name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.subdomain}.lead360.app</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

2. **TenantConfigCard.tsx**
```typescript
interface TenantConfigCardProps {
  config: TenantSmsConfig | TenantWhatsAppConfig;
  type: 'sms' | 'whatsapp';
  onTest: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function TenantConfigCard({
  config,
  type,
  onTest,
  onEdit,
  onToggleActive
}: TenantConfigCardProps) {
  return (
    <Card className={config.is_primary ? "border-primary" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">
            {config.is_primary && "⭐ "}
            {type === 'sms' ? 'SMS' : 'WhatsApp'} Configuration
          </CardTitle>
          <Badge variant={config.is_active ? 'success' : 'secondary'}>
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">From Number:</span>
            <span className="font-medium">{config.from_phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider:</span>
            <span>{config.provider_type === 'system' ? 'System (Model B)' : 'Custom (Model A)'}</span>
          </div>
          {config.created_by && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by:</span>
              <span className="text-xs">{config.created_by}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onTest} variant="outline" size="sm" className="flex-1">
            Test
          </Button>
          <Button onClick={onEdit} variant="outline" size="sm" className="flex-1">
            Edit
          </Button>
          <Button
            onClick={onToggleActive}
            variant={config.is_active ? "destructive" : "default"}
            size="sm"
            className="flex-1"
          >
            {config.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

3. **CreateTenantSmsConfigModal.tsx**
```typescript
interface CreateTenantSmsConfigModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  availablePhoneNumbers: PhoneNumber[];
  onCreate: (data: CreateTenantSmsConfigDto) => Promise<void>;
}

export function CreateTenantSmsConfigModal({
  open,
  onClose,
  tenantId,
  tenantName,
  availablePhoneNumbers,
  onCreate
}: CreateTenantSmsConfigModalProps) {
  const [providerType, setProviderType] = useState<'system' | 'custom'>('system');
  const [fromPhone, setFromPhone] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate({
        provider_type: providerType,
        from_phone: fromPhone,
        account_sid: providerType === 'custom' ? accountSid : undefined,
        auth_token: providerType === 'custom' ? authToken : undefined
      });
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Create SMS Config for ${tenantName}`}>
      <div className="space-y-4">
        <div>
          <Label>Provider Type</Label>
          <RadioGroup value={providerType} onValueChange={(v) => setProviderType(v as any)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system">
                System Provider (Model B)
                <p className="text-xs text-muted-foreground">Use platform's Twilio account</p>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom">
                Custom Provider (Model A)
                <p className="text-xs text-muted-foreground">Tenant's own Twilio account</p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {providerType === 'system' ? (
          <div>
            <Label htmlFor="fromPhone">Select Phone Number</Label>
            <Select value={fromPhone} onValueChange={setFromPhone}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an available number" />
              </SelectTrigger>
              <SelectContent>
                {availablePhoneNumbers.filter(p => p.status === 'available').map(number => (
                  <SelectItem key={number.sid} value={number.phone_number}>
                    {number.friendly_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Only showing available numbers from system pool
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="fromPhone">From Phone Number</Label>
              <Input
                id="fromPhone"
                type="tel"
                value={fromPhone}
                onChange={(e) => setFromPhone(e.target.value)}
                placeholder="+15555555555"
              />
            </div>
            <div>
              <Label htmlFor="accountSid">Twilio Account SID</Label>
              <Input
                id="accountSid"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <Label htmlFor="authToken">Twilio Auth Token</Label>
              <Input
                id="authToken"
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Enter tenant's auth token"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Will be encrypted before storage
              </p>
            </div>
          </>
        )}

        <Alert>
          <AlertTitle>Admin Action</AlertTitle>
          <AlertDescription>
            You are creating this configuration on behalf of the tenant. This action will be logged.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !fromPhone}>
            {creating ? "Creating..." : "Create Configuration"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

4. **TestTenantConfigModal.tsx**
```typescript
interface TestTenantConfigModalProps {
  open: boolean;
  onClose: () => void;
  tenantName: string;
  configType: 'sms' | 'whatsapp';
  onTest: () => Promise<TestConfigResult>;
}

export function TestTenantConfigModal({
  open,
  onClose,
  tenantName,
  configType,
  onTest
}: TestTenantConfigModalProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConfigResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (error) {
      // Error handled by parent
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Test ${configType.toUpperCase()} Configuration`}>
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Testing Configuration</p>
          <p className="text-lg font-semibold">{tenantName}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {configType} Configuration Test
          </p>
        </div>

        {!testResult && !testing && (
          <Alert>
            <AlertTitle>Test Configuration</AlertTitle>
            <AlertDescription>
              This will send a test {configType} message using the tenant's configuration
              to verify it works correctly.
            </AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {testResult.success ? "✓ Test Successful" : "✗ Test Failed"}
            </AlertTitle>
            <AlertDescription>
              {testResult.message}
              {testResult.success && testResult.test_message_sid && (
                <p className="text-xs mt-2 font-mono">
                  Message SID: {testResult.test_message_sid}
                </p>
              )}
              {testResult.error && (
                <p className="text-sm mt-2 text-destructive">{testResult.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={onClose} variant="outline" disabled={testing}>
            Close
          </Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? "Testing..." : "Send Test Message"}
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
// TRANSCRIPTION PROVIDER CRUD (Sprint 7)
// ============================================================================

export async function createTranscriptionProvider(dto: CreateTranscriptionProviderDto): Promise<TranscriptionProvider> {
  const { data } = await apiClient.post('/admin/communication/transcription-providers', dto);
  return data;
}

export async function getTranscriptionProvider(id: string): Promise<TranscriptionProviderDetail> {
  const { data } = await apiClient.get(`/admin/communication/transcription-providers/${id}`);
  return data;
}

export async function updateTranscriptionProvider(id: string, dto: UpdateTranscriptionProviderDto): Promise<TranscriptionProvider> {
  const { data } = await apiClient.patch(`/admin/communication/transcription-providers/${id}`, dto);
  return data;
}

export async function deleteTranscriptionProvider(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await apiClient.delete(`/admin/communication/transcription-providers/${id}`);
  return data;
}

export async function testTranscriptionProvider(id: string, audioUrl?: string): Promise<TestTranscriptionResult> {
  const { data } = await apiClient.post(`/admin/communication/transcription-providers/${id}/test`, {
    audio_url: audioUrl
  });
  return data;
}

// ============================================================================
// TENANT ASSISTANCE (Sprint 7)
// ============================================================================

export async function createTenantSmsConfig(tenantId: string, dto: CreateTenantSmsConfigDto): Promise<TenantSmsConfig> {
  const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/sms-config`, dto);
  return data;
}

export async function updateTenantSmsConfig(
  tenantId: string,
  configId: string,
  dto: UpdateTenantSmsConfigDto
): Promise<TenantSmsConfig> {
  const { data } = await apiClient.patch(`/admin/communication/tenants/${tenantId}/sms-config/${configId}`, dto);
  return data;
}

export async function createTenantWhatsAppConfig(
  tenantId: string,
  dto: CreateTenantWhatsAppConfigDto
): Promise<TenantWhatsAppConfig> {
  const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/whatsapp-config`, dto);
  return data;
}

export async function updateTenantWhatsAppConfig(
  tenantId: string,
  configId: string,
  dto: UpdateTenantWhatsAppConfigDto
): Promise<TenantWhatsAppConfig> {
  const { data } = await apiClient.patch(`/admin/communication/tenants/${tenantId}/whatsapp-config/${configId}`, dto);
  return data;
}

export async function testTenantSmsConfig(tenantId: string, configId?: string): Promise<TestConfigResult> {
  const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/test-sms`, null, {
    params: { configId }
  });
  return data;
}

export async function testTenantWhatsAppConfig(tenantId: string, configId?: string): Promise<TestConfigResult> {
  const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/test-whatsapp`, null, {
    params: { configId }
  });
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts` (extend existing)

```typescript
// ============================================================================
// TRANSCRIPTION PROVIDER TYPES
// ============================================================================

export interface CreateTranscriptionProviderDto {
  tenant_id?: string;
  provider_name: 'openai_whisper' | 'assemblyai' | 'deepgram';
  api_key: string;
  api_endpoint?: string;
  model?: string;
  language?: string;
  additional_settings?: Record<string, any>;
  is_system_default?: boolean;
  usage_limit?: number;
  cost_per_minute?: number;
}

export interface UpdateTranscriptionProviderDto {
  api_key?: string;
  api_endpoint?: string;
  model?: string;
  language?: string;
  additional_settings?: Record<string, any>;
  status?: 'active' | 'inactive';
  usage_limit?: number;
  cost_per_minute?: number;
  is_system_default?: boolean;
}

export interface TranscriptionProviderDetail {
  id: string;
  tenant?: {
    id: string;
    company_name: string;
    subdomain: string;
  };
  provider_name: string;
  api_endpoint: string;
  model: string;
  language: string;
  additional_settings: Record<string, any>;
  is_system_default: boolean;
  status: 'active' | 'inactive';
  usage_limit: number;
  usage_current: number;
  cost_per_minute: number;
  statistics: {
    total_transcriptions: number;
    successful: number;
    failed: number;
    success_rate: string;
    total_cost: string;
  };
  created_at: string;
  updated_at: string;
}

export interface TestTranscriptionResult {
  success: boolean;
  message: string;
  provider_id: string;
  provider_name: string;
  test_transcription?: {
    text: string;
    language: string;
    confidence: number;
    duration_seconds: number;
    processing_time_seconds: number;
  };
  api_response_time_ms: number;
  error?: string;
  tested_at: string;
}

// ============================================================================
// TENANT ASSISTANCE TYPES
// ============================================================================

export interface CreateTenantSmsConfigDto {
  provider_type?: 'system' | 'custom';
  from_phone: string;
  account_sid?: string;
  auth_token?: string;
}

export interface UpdateTenantSmsConfigDto {
  from_phone?: string;
  is_active?: boolean;
  account_sid?: string;
  auth_token?: string;
}

export interface TenantSmsConfig {
  id: string;
  tenant_id: string;
  provider_type: 'system' | 'custom';
  from_phone: string;
  is_primary: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantWhatsAppConfigDto {
  provider_type?: 'system' | 'custom';
  from_phone: string;
  account_sid?: string;
  auth_token?: string;
}

export interface UpdateTenantWhatsAppConfigDto {
  from_phone?: string;
  is_active?: boolean;
  account_sid?: string;
  auth_token?: string;
}

export interface TenantWhatsAppConfig {
  id: string;
  tenant_id: string;
  provider_type: 'system' | 'custom';
  from_phone: string;
  is_primary: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TestConfigResult {
  success: boolean;
  message: string;
  config_id: string;
  from_phone: string;
  test_message_sid?: string;
  sent_at?: string;
  error?: string;
  tested_at: string;
}
```

---

## Navigation Updates

Add to sidebar under Twilio Admin:
- "Transcription Providers" → `/admin/communications/twilio/transcription-providers`
- "Tenant Assistance" → `/admin/communications/twilio/tenant-assistance`

---

## Acceptance Criteria

### Transcription Provider Management
- [ ] Can view all configured transcription providers
- [ ] Provider cards show usage statistics and success rates
- [ ] Can add new transcription provider (OpenAI, Deepgram, AssemblyAI)
- [ ] API keys are masked in forms (password input type)
- [ ] Can update provider configuration (API key, settings, limits)
- [ ] Can set/unset system default provider
- [ ] Can test provider connectivity with optional audio URL
- [ ] Test results show transcription preview and performance metrics
- [ ] Can delete unused providers with confirmation
- [ ] Cannot delete system default provider (validation)
- [ ] Usage progress bars show utilization percentage
- [ ] Warning shown when usage exceeds 90% of limit

### Tenant Assistance
- [ ] Can search and select tenants from dropdown
- [ ] Selected tenant info displays correctly
- [ ] Can view tenant's existing SMS configurations
- [ ] Can view tenant's existing WhatsApp configurations
- [ ] Can create new SMS config using system or custom provider
- [ ] Can create new WhatsApp config using system or custom provider
- [ ] Available phone numbers shown for system provider
- [ ] Can update existing tenant configurations
- [ ] Can test SMS configuration (sends test message)
- [ ] Can test WhatsApp configuration (sends test message)
- [ ] Test results show success/failure with message SID
- [ ] All admin actions are logged with "created_by" field
- [ ] Configuration cards show active/inactive status

### General
- [ ] All pages mobile-responsive (375px tested)
- [ ] Dark mode support on all pages
- [ ] Navigation menu updated
- [ ] No hardcoded values
- [ ] All errors handled with modals
- [ ] Loading states on all async operations

---

## Testing Checklist

### Transcription Providers
```bash
# Create provider
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name":"openai_whisper","api_key":"sk-...","model":"whisper-1","is_system_default":true}' \
  https://api.lead360.app/api/v1/admin/communication/transcription-providers

# Get provider
curl -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/transcription-providers/{id}

# Update provider
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"usage_limit":15000}' \
  https://api.lead360.app/api/v1/admin/communication/transcription-providers/{id}

# Test provider
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/transcription-providers/{id}/test

# Delete provider
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/transcription-providers/{id}
```

### Tenant Assistance
```bash
# Create SMS config
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_type":"system","from_phone":"+15555555555"}' \
  https://api.lead360.app/api/v1/admin/communication/tenants/{tenantId}/sms-config

# Update SMS config
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":true}' \
  https://api.lead360.app/api/v1/admin/communication/tenants/{tenantId}/sms-config/{configId}

# Test SMS config
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/tenants/{tenantId}/test-sms

# Create WhatsApp config
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_type":"system","from_phone":"+15555555555"}' \
  https://api.lead360.app/api/v1/admin/communication/tenants/{tenantId}/whatsapp-config

# Test WhatsApp config
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.lead360.app/api/v1/admin/communication/tenants/{tenantId}/test-whatsapp
```

---

## Sprint 7 Summary

**Endpoints Implemented**: 11
- Transcription Provider CRUD: 5 endpoints
- Tenant Assistance: 6 endpoints

**Pages Created**: 2
- Transcription Providers Management
- Tenant Assistance Dashboard

**Components Created**: 10+
- TranscriptionProviderCard
- AddTranscriptionProviderModal
- EditTranscriptionProviderModal
- TestTranscriptionProviderModal
- TenantSelector
- TenantConfigCard
- CreateTenantSmsConfigModal
- CreateTenantWhatsAppConfigModal
- UpdateTenantConfigModal
- TestTenantConfigModal

**API Client Functions**: 11 new functions
**TypeScript Interfaces**: 12+ new interfaces

**Ready for**: Sprint 8 (Operations & Maintenance)
