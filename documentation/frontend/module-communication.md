# Communication/Notifications Module - Frontend Implementation

**Module**: Communication & Notifications  
**Target**: Next.js Frontend (App Router)  
**Sprint**: 2  
**Priority**: High  
**Estimated Effort**: 3 weeks  
**Status**: Ready for Development

---

## Overview

This document provides frontend implementation guidance for the Communication/Notifications module. You will build a modern, production-ready UI that supports dynamic provider configuration, template management, notification systems, and communication history tracking.

**Core Features**:
1. **Dynamic Form Generation**: Forms generated from provider JSON Schemas
2. **Provider Management**: Admin UI to enable/disable providers
3. **Email Configuration**: Platform (admin) and Tenant email setup
4. **Template Editor**: Handlebars template management with variable picker
5. **Notification Bell**: Real-time in-app notifications
6. **Communication History**: Complete audit trail with filters
7. **Webhook Testing**: UI to view and replay webhooks (admin only)

**Architecture**: Client-side forms + API integration + Real-time updates

---

## Prerequisites

Before starting, ensure you:

- ✅ **Backend is Complete**: All 37 API endpoints implemented and tested
- ✅ **API Documentation Exists**: `api/documentation/communication_REST_API.md` (100% coverage)
- ✅ **Review Frontend Patterns**: Read `/documentation/FRONTEND_AGENT.md`
- ✅ **Review Contract**: Read `/documentation/contracts/communication-contract.md`
- ✅ **Review Shared Conventions**: API conventions, naming conventions

**CRITICAL**: You cannot start frontend development until backend API documentation is complete and all endpoints are working.

---

## Reference Documentation

**MUST READ FIRST**:
1. **Feature Contract**: `/documentation/contracts/communication-contract.md`
2. **API Documentation**: `api/documentation/communication_REST_API.md` (backend generates this)
3. **Frontend Agent Role**: `/documentation/FRONTEND_AGENT.md`
4. **Shared Conventions**: `/documentation/shared/*.md`

---

## Implementation Phases

### **Phase 1: Dynamic Form System** (Week 1)
1. JSON Schema form generator component
2. Field type mappers (string, number, boolean, enum, etc.)
3. Validation error display
4. Preview component for dynamic forms

### **Phase 2: Provider & Configuration Pages** (Week 1-2)
1. Provider management UI (admin only)
2. Platform email config page (admin only)
3. Tenant email config page (all users)
4. Test email functionality

### **Phase 3: Template Management** (Week 2)
1. Template list page
2. Template editor with variable picker
3. Template preview
4. Category management

### **Phase 4: Notifications** (Week 2-3)
1. Notification bell component
2. Notification dropdown
3. Notification rules page
4. Real-time unread count

### **Phase 5: Communication History** (Week 3)
1. Communication history page
2. Filters (date range, channel, status)
3. Detail modal (view sent email)
4. Resend functionality

### **Phase 6: Polish & Testing** (Week 3)
1. Mobile responsiveness
2. Dark mode support
3. Error handling
4. Integration testing

---

## Phase 1: Dynamic Form System

### **The Challenge**

Providers have different configuration requirements stored as JSON Schemas. Instead of hard-coding forms for each provider, we generate forms dynamically from the provider's `credentials_schema` and `config_schema`.

**Example**: SMTP needs `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`. SendGrid only needs `api_key`.

**Solution**: Build a reusable `<DynamicForm>` component that reads JSON Schema and generates appropriate input fields.

---

### **Dynamic Form Component**

**File**: `app/components/communication/DynamicForm.tsx`

**Purpose**: Generate form fields from JSON Schema.

**Props**:
```typescript
interface DynamicFormProps {
  schema: JSONSchema;           // Provider's JSON Schema
  values: Record<string, any>;  // Current form values
  onChange: (values: Record<string, any>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}
```

**Responsibilities**:
- Parse JSON Schema `properties`, `required`, `type`, `enum`
- Render appropriate input component based on field type
- Show validation errors from backend
- Handle nested objects (if needed)

**Field Type Mapping**:
```typescript
type: "string" → <Input type="text" />
type: "string", format: "password" → <Input type="password" />
type: "string", enum: [...] → <Select> with options
type: "integer" → <Input type="number" />
type: "boolean" → <Toggle> or <Checkbox>
```

**Example Schema** (SMTP credentials_schema):
```json
{
  "type": "object",
  "required": ["smtp_username", "smtp_password"],
  "properties": {
    "smtp_username": {
      "type": "string",
      "description": "SMTP username",
      "minLength": 3
    },
    "smtp_password": {
      "type": "string",
      "format": "password",
      "description": "SMTP password"
    }
  }
}
```

**Generated Form**:
```tsx
<DynamicForm schema={smtpCredentialsSchema} values={formValues} onChange={setFormValues} />

// Should render:
<div>
  <label>SMTP Username *</label>
  <input type="text" value={values.smtp_username} onChange={...} />
  <p className="text-sm text-gray-500">SMTP username</p>
  
  <label>SMTP Password *</label>
  <input type="password" value={values.smtp_password} onChange={...} />
  <p className="text-sm text-gray-500">SMTP password</p>
</div>
```

**Implementation Pattern**:
```typescript
export function DynamicForm({ schema, values, onChange, errors }: DynamicFormProps) {
  const properties = schema.properties || {};
  const required = schema.required || [];

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([fieldName, fieldSchema]) => (
        <DynamicField
          key={fieldName}
          name={fieldName}
          schema={fieldSchema}
          value={values[fieldName]}
          onChange={(val) => onChange({ ...values, [fieldName]: val })}
          required={required.includes(fieldName)}
          error={errors?.[fieldName]}
        />
      ))}
    </div>
  );
}
```

**DynamicField Component** (renders single field):
```typescript
function DynamicField({ name, schema, value, onChange, required, error }) {
  const { type, format, enum: enumValues, description } = schema;

  // Render based on type
  if (type === 'string' && enumValues) {
    return <SelectField name={name} options={enumValues} ... />;
  }
  
  if (type === 'string' && format === 'password') {
    return <PasswordField name={name} ... />;
  }
  
  if (type === 'integer') {
    return <NumberField name={name} ... />;
  }
  
  if (type === 'boolean') {
    return <ToggleField name={name} ... />;
  }

  // Default: text input
  return <TextField name={name} ... />;
}
```

**Validation Display**:
```typescript
// In DynamicField
{error && (
  <p className="text-sm text-red-600 mt-1">{error}</p>
)}
```

**UI Requirements**:
- ✅ **Field labels**: Use `schema.description` or generate from field name
- ✅ **Required indicators**: Show asterisk (*) for required fields
- ✅ **Help text**: Show description below input
- ✅ **Validation**: Show errors inline below each field
- ✅ **Disabled state**: Support read-only mode

---

### **Testing Dynamic Forms**

**Test with All 4 Providers**:
1. SMTP: Multiple fields (host, port, username, password, encryption enum)
2. SendGrid: Single field (api_key)
3. Amazon SES: Multiple fields with enum (region)
4. Brevo: Single field (api_key)

**Verify**:
- Correct input types rendered
- Required fields marked
- Enums render as dropdowns
- Password fields masked
- Validation errors display correctly

---

## Phase 2: Provider & Configuration Pages

### **Provider Management Page** (Admin Only)

**Route**: `/admin/communication/providers`

**Purpose**: Platform admins view all available providers and enable/disable them.

**API Endpoint**: `GET /api/v1/admin/communication/providers`

**Page Structure**:
```
┌─────────────────────────────────────────┐
│  Communication Providers                │
├─────────────────────────────────────────┤
│                                         │
│  [Search providers...]                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ SMTP                 [Active ✓] │   │
│  │ Generic SMTP support            │   │
│  │ Webhooks: No                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ SendGrid             [Active ✓] │   │
│  │ Email delivery platform         │   │
│  │ Webhooks: Yes (signature)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Amazon SES           [Active ✓] │   │
│  │ AWS email service               │   │
│  │ Webhooks: Yes (SNS signature)   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Brevo                [Active ✓] │   │
│  │ Email marketing platform        │   │
│  │ Webhooks: Yes (token)           │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:
- ✅ List all providers (active and inactive)
- ✅ Toggle active/inactive status (PATCH `/admin/communication/providers/:key/toggle`)
- ✅ View provider details (modal or detail page)
- ✅ Filter by provider_type (email, sms, call)
- ✅ Search by provider name

**Provider Card Component**:
```typescript
interface ProviderCardProps {
  provider: {
    provider_key: string;
    provider_name: string;
    provider_type: string;
    supports_webhooks: boolean;
    webhook_verification_method?: string;
    is_active: boolean;
    is_system: boolean;
  };
  onToggleActive: (key: string) => void;
}

// Render:
<div className="bg-white rounded-lg shadow p-4">
  <div className="flex justify-between items-start">
    <div>
      <h3>{provider.provider_name}</h3>
      <p className="text-sm text-gray-500">
        {provider.provider_type} provider
      </p>
      {provider.supports_webhooks && (
        <p className="text-sm text-gray-500">
          Webhooks: {provider.webhook_verification_method}
        </p>
      )}
    </div>
    <Toggle
      checked={provider.is_active}
      onChange={() => onToggleActive(provider.provider_key)}
      disabled={provider.is_system}  // System providers cannot be disabled
    />
  </div>
</div>
```

**RBAC**: Only Platform Admins can access this page. Use `PlatformAdminGuard`.

---

### **Platform Email Configuration Page** (Admin Only)

**Route**: `/admin/communication/email-config`

**Purpose**: Configure platform-wide email settings for system emails (password resets, notifications).

**API Endpoints**:
- `GET /api/v1/admin/communication/email-config` - Get current config
- `POST /api/v1/admin/communication/email-config` - Update config
- `POST /api/v1/admin/communication/email-config/test` - Send test email

**Page Structure**:
```
┌─────────────────────────────────────────┐
│  Platform Email Configuration          │
├─────────────────────────────────────────┤
│                                         │
│  Provider *                             │
│  [Select Provider ▾]                    │
│   ├─ SMTP                               │
│   ├─ SendGrid                           │
│   ├─ Amazon SES                         │
│   └─ Brevo                              │
│                                         │
│  ──────────────────────────────────     │
│  Provider Credentials                   │
│  ──────────────────────────────────     │
│  (Dynamic fields based on selected      │
│   provider's credentials_schema)        │
│                                         │
│  ──────────────────────────────────     │
│  Provider Configuration                 │
│  ──────────────────────────────────     │
│  (Dynamic fields based on selected      │
│   provider's config_schema)             │
│                                         │
│  ──────────────────────────────────     │
│  Email Settings                         │
│  ──────────────────────────────────     │
│  From Email *                           │
│  [noreply@lead360.app        ]          │
│                                         │
│  From Name *                            │
│  [Lead360 Platform           ]          │
│                                         │
│  Webhook Secret (optional)              │
│  [●●●●●●●●●●●●●●●●●●●●●●●●  ]          │
│                                         │
│  [Test Email]  [Save Configuration]     │
│                                         │
└─────────────────────────────────────────┘
```

**Implementation Flow**:
1. **Load providers**: Fetch active providers on page load
2. **Select provider**: When user selects provider, fetch its schemas
3. **Render dynamic forms**: Use `<DynamicForm>` for credentials + config
4. **Save**: Submit to API with validation
5. **Test**: Send test email before saving

**State Management**:
```typescript
const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
const [credentials, setCredentials] = useState<Record<string, any>>({});
const [config, setConfig] = useState<Record<string, any>>({});
const [fromEmail, setFromEmail] = useState('');
const [fromName, setFromName] = useState('');
const [webhookSecret, setWebhookSecret] = useState('');
const [errors, setErrors] = useState<Record<string, string>>({});
```

**Provider Selection Handler**:
```typescript
async function handleProviderChange(providerKey: string) {
  // Fetch provider details with schemas
  const provider = await communicationApi.getProvider(providerKey);
  setSelectedProvider(provider);
  
  // Reset credentials/config
  setCredentials({});
  setConfig({});
}
```

**Test Email**:
```typescript
async function handleTestEmail() {
  try {
    setLoading(true);
    await communicationApi.testPlatformEmail({
      to: 'your-email@example.com',  // Prompt user for test email
    });
    toast.success('Test email sent! Check your inbox.');
  } catch (error) {
    toast.error('Test email failed: ' + error.message);
  } finally {
    setLoading(false);
  }
}
```

**Save Configuration**:
```typescript
async function handleSave() {
  try {
    setLoading(true);
    await communicationApi.updatePlatformEmailConfig({
      provider_key: selectedProvider.provider_key,
      credentials,
      provider_config: config,
      from_email: fromEmail,
      from_name: fromName,
      webhook_secret: webhookSecret || undefined,
    });
    toast.success('Email configuration saved successfully');
  } catch (error) {
    // Display validation errors
    if (error.errors) {
      setErrors(error.errors);
    }
    toast.error('Failed to save configuration');
  } finally {
    setLoading(false);
  }
}
```

**Validation Errors**:
Backend returns errors in this format:
```json
{
  "message": "Invalid credentials format",
  "errors": {
    "credentials.api_key": "API key must start with 'SG.'",
    "from_email": "Invalid email format"
  }
}
```

Display errors inline in dynamic form and static fields.

---

### **Tenant Email Configuration Page**

**Route**: `/communication/email-config`

**Purpose**: Tenants configure their own email provider for sending customer emails (quotes, invoices).

**API Endpoints**:
- `GET /api/v1/communication/providers` - List available providers
- `GET /api/v1/communication/tenant-email-config` - Get current config
- `POST /api/v1/communication/tenant-email-config` - Create/update config
- `POST /api/v1/communication/tenant-email-config/test` - Send test email

**Page Structure**: Identical to Platform Email Config, but with different API endpoints.

**Differences**:
- Accessible by all tenant users (not just admins)
- Editing restricted to Owner/Admin roles (RBAC)
- Additional field: `reply_to_email` (optional)
- Config status indicator: `is_verified` badge

**Config Status Badge**:
```tsx
{config.is_verified ? (
  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
    ✓ Verified
  </span>
) : (
  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
    ⚠ Not Verified - Send test email
  </span>
)}
```

**Helpful Examples** (for common providers):

**Gmail SMTP Example**:
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
Encryption: TLS
Username: your-email@gmail.com
Password: [App-specific password]

Note: You must enable 2FA and generate an App Password in Gmail settings.
```

**Office 365 SMTP Example**:
```
SMTP Host: smtp.office365.com
SMTP Port: 587
Encryption: TLS
Username: your-email@company.com
Password: [Your Office 365 password]
```

Display these examples in a collapsible "Help" section.

---

## Phase 3: Template Management

### **Template List Page**

**Route**: `/communication/templates`

**Purpose**: Manage email templates (admin templates + tenant templates).

**API Endpoint**: `GET /api/v1/communication/templates`

**Page Structure**:
```
┌─────────────────────────────────────────┐
│  Email Templates                [+ New] │
├─────────────────────────────────────────┤
│                                         │
│  [Search templates...]  [Filter ▾]      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Password Reset (System)         │   │
│  │ Sent when user requests password│   │
│  │ reset                           │   │
│  │ Variables: userName, resetLink  │   │
│  │             [Preview] [Edit]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Quote Sent (Transactional)      │   │
│  │ Sent when quote is emailed to   │   │
│  │ customer                        │   │
│  │ Variables: customerName, quote  │   │
│  │             [Preview] [Edit] [Del]  │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:
- ✅ List all templates (admin + tenant-specific)
- ✅ Filter by category (system, transactional, marketing, notification)
- ✅ Search by template name
- ✅ Preview template (modal with sample data)
- ✅ Edit template (navigate to editor)
- ✅ Delete template (confirmation modal, only non-system templates)

**Template Card**:
```typescript
interface TemplateCardProps {
  template: {
    id: string;
    template_key: string;
    subject: string;
    description: string;
    category: string;
    is_system: boolean;
    is_active: boolean;
    variables: string[];  // Extracted from variable_schema
  };
  onPreview: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}
```

**System Template Badge**:
```tsx
{template.is_system && (
  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
    System
  </span>
)}
```

**RBAC**:
- View: All users
- Create/Edit/Delete: Owner, Admin roles only
- System templates: View/Preview only (cannot edit/delete)

---

### **Template Editor**

**Route**: `/communication/templates/[id]/edit` or `/communication/templates/new`

**Purpose**: Create or edit email template with Handlebars syntax and variable picker.

**API Endpoints**:
- `GET /api/v1/communication/templates/:key` - Get template
- `POST /api/v1/communication/templates` - Create template
- `PATCH /api/v1/communication/templates/:key` - Update template
- `POST /api/v1/communication/templates/:key/preview` - Preview with sample data

**Page Structure**:
```
┌───────────────────────────────────────────────────────┐
│  Edit Template: Quote Sent               [Save] [Cancel]│
├───────────────────────────────────────────────────────┤
│                                                       │
│  Template Key *                                       │
│  [quote-sent                                    ]     │
│                                                       │
│  Category *                                           │
│  [Transactional ▾]                                    │
│                                                       │
│  Subject *                                            │
│  [Your Quote from {{companyName}}           ]         │
│  Available: {{customerName}}, {{companyName}}, ...    │
│                                                       │
│  HTML Body *                                          │
│  ┌─────────────────────────────────────────────┐     │
│  │ <h1>Hi {{customerName}},</h1>              │     │
│  │                                             │     │
│  │ <p>Thank you for your interest! Please     │     │
│  │ review your quote below:</p>                │     │
│  │                                             │     │
│  │ <p><strong>Quote #{{quoteNumber}}</strong> │     │
│  │ Total: ${{quoteTotal}}</p>                  │     │
│  │                                             │     │
│  │ <p>Valid until: {{validUntil}}</p>          │     │
│  │                                             │     │
│  │ <a href="{{quoteLink}}">View Quote</a>     │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  Text Body (optional)                                 │
│  ┌─────────────────────────────────────────────┐     │
│  │ Hi {{customerName}},                        │     │
│  │                                             │     │
│  │ Thank you for your interest!                │     │
│  │ Quote #{{quoteNumber}}: ${{quoteTotal}}    │     │
│  │                                             │     │
│  │ Valid until: {{validUntil}}                 │     │
│  │ View quote: {{quoteLink}}                   │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  Description                                          │
│  [Sent when quote is emailed to customer      ]     │
│                                                       │
│  ──────────────────────────────────────               │
│  Available Variables                                  │
│  ──────────────────────────────────────               │
│  • customerName - Customer's full name                │
│  • companyName - Your company name                    │
│  • quoteNumber - Quote reference number               │
│  • quoteTotal - Total amount formatted                │
│  • validUntil - Quote expiration date                 │
│  • quoteLink - Link to view quote                     │
│                                                       │
│  [Preview Template]                                   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Features**:
- ✅ **Rich text editor**: HTML body editor (TipTap or similar)
- ✅ **Variable picker**: Click to insert `{{variableName}}`
- ✅ **Syntax highlighting**: Highlight Handlebars syntax
- ✅ **Live preview**: Modal showing rendered template with sample data
- ✅ **Validation**: Ensure valid Handlebars syntax before saving

**Variable Picker Component**:
```typescript
interface VariablePickerProps {
  variables: {
    name: string;
    type: string;
    description: string;
    example: string;
  }[];
  onInsert: (varName: string) => void;
}

// Render as dropdown or sidebar
<div>
  {variables.map(v => (
    <button onClick={() => onInsert(v.name)}>
      <strong>{v.name}</strong>
      <p className="text-sm">{v.description}</p>
      <p className="text-xs text-gray-500">Example: {v.example}</p>
    </button>
  ))}
</div>
```

**Preview Modal**:
```typescript
async function handlePreview() {
  const response = await communicationApi.previewTemplate({
    template_key: formData.template_key,
    html_body: formData.html_body,
    text_body: formData.text_body,
    subject: formData.subject,
    sample_data: {
      customerName: 'John Doe',
      companyName: 'Acme Plumbing',
      quoteNumber: 'Q-12345',
      quoteTotal: '$1,250.00',
      validUntil: '2026-02-01',
      quoteLink: 'https://acmeplumbing.lead360.app/quotes/12345',
    },
  });

  // Show rendered HTML in modal
  setPreviewHtml(response.rendered_html);
  setPreviewSubject(response.rendered_subject);
  setShowPreviewModal(true);
}
```

**Handlebars Validation**:
Backend should validate template syntax. If invalid, show errors:
```tsx
{errors.html_body && (
  <p className="text-red-600">
    Invalid Handlebars syntax: {errors.html_body}
  </p>
)}
```

---

## Phase 4: Notifications

### **Notification Bell Component**

**Component**: `<NotificationBell />` (used in app header)

**Purpose**: Show unread notification count, dropdown with recent notifications.

**API Endpoints**:
- `GET /api/v1/communication/notifications/unread-count` - Get unread count
- `GET /api/v1/communication/notifications?limit=10` - Get recent notifications
- `PATCH /api/v1/communication/notifications/:id/read` - Mark as read
- `POST /api/v1/communication/notifications/mark-all-read` - Mark all read

**Component Structure**:
```
┌─────────────────────────────┐
│  🔔 [3]                     │  ← Bell icon with badge
└─────────────────────────────┘
         ↓ (on click)
┌─────────────────────────────────────┐
│  Notifications         [Mark all read]│
├─────────────────────────────────────┤
│                                     │
│  ● New lead created                 │
│    John Doe submitted request       │
│    2 minutes ago                    │
│                                     │
│  ● Quote approved                   │
│    Quote #12345 was approved        │
│    1 hour ago                       │
│                                     │
│  ○ Invoice paid                     │
│    Invoice #67890 paid              │
│    Yesterday                        │
│                                     │
│  [View All Notifications]           │
│                                     │
└─────────────────────────────────────┘
```

**Features**:
- ✅ **Unread badge**: Red badge with count
- ✅ **Dropdown**: Shows 10 most recent notifications
- ✅ **Read/Unread indicator**: Filled/hollow circle
- ✅ **Click to navigate**: Click notification → navigate to action_url
- ✅ **Mark as read**: Automatically mark read when clicked
- ✅ **Mark all read**: Button to mark all as read
- ✅ **Real-time updates**: Poll for new notifications every 30s

**Implementation Pattern**:
```typescript
export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Poll for unread count
  useEffect(() => {
    async function fetchUnreadCount() {
      const count = await communicationApi.getUnreadCount();
      setUnreadCount(count);
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);  // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  async function handleOpen() {
    setIsOpen(true);
    const notifs = await communicationApi.getNotifications({ limit: 10 });
    setNotifications(notifs);
  }

  // Mark notification as read and navigate
  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      await communicationApi.markAsRead(notification.id);
      setUnreadCount(prev => prev - 1);
    }
    
    if (notification.action_url) {
      router.push(notification.action_url);
    }
    
    setIsOpen(false);
  }

  return (
    <div className="relative">
      {/* Bell icon */}
      <button onClick={handleOpen}>
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-lg">
          {/* Notification list */}
          {notifications.map(n => (
            <NotificationItem 
              key={n.id} 
              notification={n} 
              onClick={() => handleNotificationClick(n)} 
            />
          ))}
          
          <button onClick={handleMarkAllRead}>Mark all read</button>
          <Link href="/communication/notifications">View All</Link>
        </div>
      )}
    </div>
  );
}
```

**Notification Item Component**:
```typescript
interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    action_url?: string;
  };
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  return (
    <div 
      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
        !notification.is_read ? 'bg-blue-50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Read/Unread indicator */}
        <span className={`mt-1 ${notification.is_read ? 'text-gray-400' : 'text-blue-600'}`}>
          {notification.is_read ? '○' : '●'}
        </span>
        
        <div className="flex-1">
          <p className="font-medium">{notification.title}</p>
          <p className="text-sm text-gray-600">{notification.message}</p>
          <p className="text-xs text-gray-400">{formatRelativeTime(notification.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
```

---

### **Notification Rules Page**

**Route**: `/communication/notification-rules`

**Purpose**: Configure auto-notification rules (e.g., notify when lead created).

**API Endpoints**:
- `GET /api/v1/communication/notification-rules` - List rules
- `POST /api/v1/communication/notification-rules` - Create rule
- `PATCH /api/v1/communication/notification-rules/:id` - Update rule
- `DELETE /api/v1/communication/notification-rules/:id` - Delete rule

**Page Structure**:
```
┌─────────────────────────────────────────┐
│  Notification Rules             [+ New] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Lead Created                    │   │
│  │ When: Lead is created           │   │
│  │ Notify: All users (in-app)      │   │
│  │ [Active ✓]  [Edit] [Delete]     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Quote Approved                  │   │
│  │ When: Quote status = approved   │   │
│  │ Notify: Owner (in-app + email)  │   │
│  │ Template: quote-approved        │   │
│  │ [Active ✓]  [Edit] [Delete]     │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Create/Edit Rule Modal**:
```
┌─────────────────────────────────────────┐
│  Create Notification Rule      [Save]  │
├─────────────────────────────────────────┤
│                                         │
│  Event Type *                           │
│  [Lead Created ▾]                       │
│   ├─ Lead Created                       │
│   ├─ Quote Sent                         │
│   ├─ Quote Approved                     │
│   ├─ Invoice Paid                       │
│   └─ ...                                │
│                                         │
│  ──────────────────────────────────     │
│  Notification Settings                  │
│  ──────────────────────────────────     │
│  ☑ In-App Notification                  │
│  ☐ Email Notification                   │
│                                         │
│  (If email checked)                     │
│  Email Template *                       │
│  [Select template ▾]                    │
│                                         │
│  Recipient *                            │
│  ○ Owner                                │
│  ○ Assigned User                        │
│  ○ Specific Users                       │
│  ○ All Users                            │
│                                         │
│  (If "Specific Users" selected)         │
│  Select Users                           │
│  [☑ John Doe]                           │
│  [☐ Jane Smith]                         │
│                                         │
│  ☑ Active                               │
│                                         │
│  [Cancel]                      [Save]   │
│                                         │
└─────────────────────────────────────────┘
```

**Validation Rules**:
- If `notify_email = true`, `email_template_key` required
- If `recipient_type = 'specific_users'`, `specific_user_ids` required

---

## Phase 5: Communication History

### **Communication History Page**

**Route**: `/communication/history`

**Purpose**: View all sent emails with filters and search.

**API Endpoint**: `GET /api/v1/communication/history`

**Query Parameters**:
- `page`, `limit` (pagination)
- `channel` (email, sms, call)
- `status` (pending, sent, delivered, failed, bounced)
- `from_date`, `to_date` (date range)
- `to_email` (search by recipient)
- `related_entity_type`, `related_entity_id` (filter by entity)

**Page Structure**:
```
┌───────────────────────────────────────────────────────────┐
│  Communication History                                    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [Search by recipient...]    [Filters ▾]  [Export CSV]   │
│                                                           │
│  Filters:                                                 │
│  Channel: [All ▾]  Status: [All ▾]  Date: [Last 30 days ▾]│
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ To: customer@example.com         Status: Delivered  │ │
│  │ Subject: Your Quote from Acme Plumbing              │ │
│  │ Provider: SendGrid                                  │ │
│  │ Sent: Jan 15, 2026 2:30 PM                          │ │
│  │ Delivered: Jan 15, 2026 2:31 PM                     │ │
│  │ Opened: Jan 15, 2026 3:45 PM                        │ │
│  │ Related: Quote #12345                               │ │
│  │                    [View Details] [Resend]          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ To: info@company.com              Status: Failed    │ │
│  │ Subject: Password Reset Request                     │ │
│  │ Provider: SMTP                                      │ │
│  │ Sent: Jan 14, 2026 9:15 AM                          │ │
│  │ Error: SMTP connection timeout                      │ │
│  │                    [View Details] [Resend]          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ To: user@test.com                 Status: Bounced   │ │
│  │ Subject: Your Invoice is Ready                      │ │
│  │ Provider: Amazon SES                                │ │
│  │ Sent: Jan 13, 2026 11:00 AM                         │ │
│  │ Bounced: Jan 13, 2026 11:01 AM (Hard bounce)        │ │
│  │ Related: Invoice #67890                             │ │
│  │                    [View Details]                   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  [← Previous]  Page 1 of 10  [Next →]                    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Features**:
- ✅ **Status badges**: Color-coded (green=delivered, red=failed, yellow=pending)
- ✅ **Webhook data**: Show delivered_at, opened_at, clicked_at if available
- ✅ **Filters**: Channel, status, date range
- ✅ **Search**: By recipient email
- ✅ **Related entity**: Link to quote/invoice/lead
- ✅ **View details**: Modal with full email content
- ✅ **Resend**: Resend failed emails
- ✅ **Export**: Download history as CSV

**Communication Event Card**:
```typescript
interface CommunicationCardProps {
  event: {
    id: string;
    to_email: string;
    subject: string;
    status: string;
    provider: { provider_name: string };
    sent_at?: string;
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    bounced_at?: string;
    bounce_type?: string;
    error_message?: string;
    related_entity_type?: string;
    related_entity_id?: string;
  };
  onViewDetails: (id: string) => void;
  onResend: (id: string) => void;
}
```

**Status Badge Component**:
```typescript
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    bounced: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded text-sm ${colors[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

---

### **Email Detail Modal**

**Purpose**: Show complete email details including HTML preview.

**Content**:
```
┌─────────────────────────────────────────┐
│  Email Details                   [Close]│
├─────────────────────────────────────────┤
│                                         │
│  To: customer@example.com               │
│  From: info@acmeplumbing.com            │
│  Subject: Your Quote from Acme Plumbing │
│                                         │
│  Provider: SendGrid                     │
│  Status: Delivered ✓                    │
│                                         │
│  Timeline:                              │
│  • Sent: Jan 15, 2026 2:30 PM           │
│  • Delivered: Jan 15, 2026 2:31 PM      │
│  • Opened: Jan 15, 2026 3:45 PM         │
│  • Clicked: Jan 15, 2026 4:00 PM        │
│                                         │
│  Related To: Quote #12345               │
│  Template Used: quote-sent              │
│                                         │
│  ──────────────────────────────────     │
│  Email Preview                          │
│  ──────────────────────────────────     │
│  ┌─────────────────────────────────┐   │
│  │ (Rendered HTML preview)         │   │
│  │ Hi John Doe,                    │   │
│  │                                 │   │
│  │ Thank you for your interest!    │   │
│  │ Please review your quote...     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [View HTML Source]  [Resend Email]    │
│                                         │
└─────────────────────────────────────────┘
```

**Resend Functionality**:
```typescript
async function handleResend(eventId: string) {
  // Confirm with user
  const confirmed = await showConfirmModal({
    title: 'Resend Email?',
    message: 'This will send a new copy of this email to the recipient.',
  });

  if (confirmed) {
    try {
      await communicationApi.resendEmail(eventId);
      toast.success('Email resent successfully');
    } catch (error) {
      toast.error('Failed to resend email: ' + error.message);
    }
  }
}
```

---

## Phase 6: Polish & Testing

### **Mobile Responsiveness**

**Test on Mobile Devices** (375px width):
- ✅ Dynamic forms: Stack vertically, large touch targets
- ✅ Provider cards: Full width, readable text
- ✅ Email config: Multi-step form (one section per screen)
- ✅ Template editor: Simplified on mobile, full editor on desktop
- ✅ Notification bell: Dropdown positioned correctly
- ✅ Communication history: Cards instead of table, filters in modal

**Mobile Patterns**:
```tsx
// Stack form fields vertically on mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input label="From Email" />
  <Input label="From Name" />
</div>

// Hide less important content on mobile
<div className="hidden md:block">
  <ProviderDocumentationLink />
</div>
```

---

### **Dark Mode Support**

**Use Tailwind Dark Mode**:
```tsx
// tailwind.config.ts
export default {
  darkMode: 'class',  // or 'media'
  theme: {
    extend: {
      colors: {
        // Define dark mode colors
      },
    },
  },
};

// In components
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  Content
</div>
```

**Test Both Modes**:
- ✅ All pages readable in dark mode
- ✅ Sufficient contrast (WCAG AA)
- ✅ Form inputs visible
- ✅ Modals have dark background

---

### **Error Handling**

**Global Error Boundary**:
```typescript
// app/error.tsx
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button onClick={reset} className="btn-primary">
        Try Again
      </button>
    </div>
  );
}
```

**API Error Handling Pattern**:
```typescript
try {
  const result = await communicationApi.sendEmail(data);
  toast.success('Email sent successfully');
  router.push('/communication/history');
} catch (error) {
  if (error.status === 400) {
    // Validation errors - show inline
    setErrors(error.errors);
  } else if (error.status === 401) {
    // Unauthorized - redirect to login
    router.push('/login');
  } else if (error.status === 403) {
    // Forbidden - show permission error
    toast.error('You do not have permission to perform this action');
  } else {
    // Generic error
    toast.error('An unexpected error occurred. Please try again.');
  }
}
```

---

### **Loading States**

**Use Suspense for Server Components**:
```tsx
// app/communication/history/page.tsx
import { Suspense } from 'react';
import { CommunicationHistoryList } from '@/components/communication/CommunicationHistoryList';
import { CommunicationHistorySkeleton } from '@/components/communication/CommunicationHistorySkeleton';

export default function CommunicationHistoryPage() {
  return (
    <div>
      <h1>Communication History</h1>
      <Suspense fallback={<CommunicationHistorySkeleton />}>
        <CommunicationHistoryList />
      </Suspense>
    </div>
  );
}
```

**Skeleton Loaders** (better than spinners):
```tsx
export function CommunicationCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}
```

---

## Testing Checklist

### **Unit Tests** (React Testing Library)

**Test Dynamic Form**:
```typescript
describe('DynamicForm', () => {
  it('renders text input for string type', () => {
    const schema = {
      properties: {
        username: { type: 'string', description: 'Username' },
      },
    };
    
    render(<DynamicForm schema={schema} values={{}} onChange={() => {}} />);
    
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('renders select for enum type', () => {
    const schema = {
      properties: {
        encryption: { 
          type: 'string', 
          enum: ['none', 'tls', 'ssl'],
        },
      },
    };
    
    render(<DynamicForm schema={schema} values={{}} onChange={() => {}} />);
    
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
```

**Test Notification Bell**:
```typescript
describe('NotificationBell', () => {
  it('displays unread count badge', async () => {
    // Mock API
    jest.spyOn(communicationApi, 'getUnreadCount').mockResolvedValue(3);
    
    render(<NotificationBell />);
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('opens dropdown on click', async () => {
    render(<NotificationBell />);
    
    const bell = screen.getByRole('button');
    fireEvent.click(bell);
    
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });
});
```

---

### **Integration Tests**

**Test Complete Email Config Flow**:
```typescript
describe('Email Configuration Flow', () => {
  it('configures SendGrid provider successfully', async () => {
    // 1. Navigate to config page
    render(<TenantEmailConfigPage />);
    
    // 2. Select SendGrid provider
    const providerSelect = screen.getByLabelText('Provider');
    fireEvent.change(providerSelect, { target: { value: 'sendgrid' } });
    
    // 3. Fill in API key (dynamic form)
    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText(/API Key/i);
      fireEvent.change(apiKeyInput, { target: { value: 'SG.test123' } });
    });
    
    // 4. Fill in email settings
    fireEvent.change(screen.getByLabelText('From Email'), {
      target: { value: 'info@acmeplumbing.com' },
    });
    fireEvent.change(screen.getByLabelText('From Name'), {
      target: { value: 'Acme Plumbing' },
    });
    
    // 5. Submit
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);
    
    // 6. Verify success
    await waitFor(() => {
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
  });
});
```

---

## API Integration Summary

### **API Client Structure**

**File**: `lib/api/communication.ts`

**Methods**:
```typescript
export const communicationApi = {
  // Provider Registry
  getProviders: () => fetch('/api/v1/communication/providers'),
  getProvider: (key: string) => fetch(`/api/v1/admin/communication/providers/${key}`),
  toggleProvider: (key: string) => patch(`/admin/communication/providers/${key}/toggle`),
  
  // Platform Email Config
  getPlatformEmailConfig: () => fetch('/api/v1/admin/communication/email-config'),
  updatePlatformEmailConfig: (data) => post('/api/v1/admin/communication/email-config', data),
  testPlatformEmail: (data) => post('/api/v1/admin/communication/email-config/test', data),
  
  // Tenant Email Config
  getTenantEmailConfig: () => fetch('/api/v1/communication/tenant-email-config'),
  updateTenantEmailConfig: (data) => post('/api/v1/communication/tenant-email-config', data),
  testTenantEmail: (data) => post('/api/v1/communication/tenant-email-config/test', data),
  
  // Templates
  getTemplates: (params?) => fetch('/api/v1/communication/templates', { params }),
  getTemplate: (key: string) => fetch(`/api/v1/communication/templates/${key}`),
  createTemplate: (data) => post('/api/v1/communication/templates', data),
  updateTemplate: (key: string, data) => patch(`/api/v1/communication/templates/${key}`, data),
  deleteTemplate: (key: string) => del(`/api/v1/communication/templates/${key}`),
  previewTemplate: (data) => post('/api/v1/communication/templates/preview', data),
  
  // Communication History
  getHistory: (params) => fetch('/api/v1/communication/history', { params }),
  getEvent: (id: string) => fetch(`/api/v1/communication/history/${id}`),
  resendEmail: (id: string) => post(`/api/v1/communication/history/${id}/resend`),
  
  // Notifications
  getNotifications: (params?) => fetch('/api/v1/communication/notifications', { params }),
  getUnreadCount: () => fetch('/api/v1/communication/notifications/unread-count'),
  markAsRead: (id: string) => patch(`/api/v1/communication/notifications/${id}/read`),
  markAllRead: () => post('/api/v1/communication/notifications/mark-all-read'),
  
  // Notification Rules
  getRules: () => fetch('/api/v1/communication/notification-rules'),
  createRule: (data) => post('/api/v1/communication/notification-rules', data),
  updateRule: (id: string, data) => patch(`/api/v1/communication/notification-rules/${id}`, data),
  deleteRule: (id: string) => del(`/api/v1/communication/notification-rules/${id}`),
};
```

---

## File Structure Summary

**Final File Structure**:
```
app/
├── (dashboard)/
│   └── communication/
│       ├── email-config/
│       │   └── page.tsx                    (Tenant email config)
│       ├── templates/
│       │   ├── page.tsx                    (Template list)
│       │   ├── new/
│       │   │   └── page.tsx                (Create template)
│       │   └── [key]/
│       │       └── edit/
│       │           └── page.tsx            (Edit template)
│       ├── history/
│       │   └── page.tsx                    (Communication history)
│       ├── notifications/
│       │   └── page.tsx                    (All notifications)
│       └── notification-rules/
│           └── page.tsx                    (Notification rules)
└── admin/
    └── communication/
        ├── providers/
        │   └── page.tsx                    (Provider management)
        └── email-config/
            └── page.tsx                    (Platform email config)

components/
├── communication/
│   ├── DynamicForm.tsx                     (JSON Schema form generator)
│   ├── DynamicField.tsx                    (Single field renderer)
│   ├── ProviderCard.tsx
│   ├── ProviderSelector.tsx
│   ├── EmailConfigForm.tsx
│   ├── TemplateCard.tsx
│   ├── TemplateEditor.tsx
│   ├── VariablePicker.tsx
│   ├── TemplatePreviewModal.tsx
│   ├── NotificationBell.tsx                (Bell component)
│   ├── NotificationDropdown.tsx
│   ├── NotificationItem.tsx
│   ├── NotificationRuleCard.tsx
│   ├── NotificationRuleModal.tsx
│   ├── CommunicationCard.tsx
│   ├── CommunicationDetailModal.tsx
│   ├── CommunicationFilters.tsx
│   └── StatusBadge.tsx
└── ui/
    ├── Input.tsx
    ├── Select.tsx
    ├── Toggle.tsx
    ├── Modal.tsx
    └── ...

lib/
└── api/
    └── communication.ts                    (API client)
```

---

## Completion Checklist

**Frontend is complete when**:

### **Dynamic Forms**
- [ ] DynamicForm component renders all field types correctly
- [ ] Validation errors display inline
- [ ] Required fields marked with asterisk
- [ ] Help text shows from schema description
- [ ] Tested with all 4 provider schemas

### **Provider & Configuration**
- [ ] Provider management page (admin only) working
- [ ] Can toggle provider active/inactive
- [ ] Platform email config page (admin only) working
- [ ] Tenant email config page working
- [ ] Test email functionality working
- [ ] Dynamic forms render based on selected provider
- [ ] Helpful examples shown for Gmail/Office 365

### **Templates**
- [ ] Template list page showing admin + tenant templates
- [ ] Template editor with rich text editor
- [ ] Variable picker working
- [ ] Preview modal renders template with sample data
- [ ] Can create/edit/delete tenant templates
- [ ] System templates are read-only

### **Notifications**
- [ ] Notification bell shows unread count
- [ ] Dropdown shows recent notifications
- [ ] Clicking notification navigates to action_url
- [ ] Notifications marked as read on click
- [ ] Mark all read working
- [ ] Real-time updates (polling every 30s)
- [ ] Notification rules page working
- [ ] Can create/edit/delete rules

### **Communication History**
- [ ] History page lists all communications
- [ ] Filters working (channel, status, date range)
- [ ] Search by recipient working
- [ ] Status badges color-coded correctly
- [ ] Webhook data displayed (delivered_at, opened_at, etc.)
- [ ] Detail modal shows email preview
- [ ] Resend functionality working
- [ ] Related entity links working

### **Quality**
- [ ] Mobile responsive (all pages tested at 375px)
- [ ] Dark mode supported
- [ ] All modals working (no browser alerts)
- [ ] Loading states everywhere (skeletons, not just spinners)
- [ ] Error handling with retry options
- [ ] Success feedback (toasts)
- [ ] Accessibility standards met (ARIA labels, keyboard nav)

### **Integration**
- [ ] All API endpoints integrated correctly
- [ ] JWT authentication working
- [ ] RBAC enforced (admin pages require Platform Admin)
- [ ] Tenant isolation verified (cannot see other tenant's data)
- [ ] No console errors
- [ ] No TypeScript errors

### **Testing**
- [ ] Unit tests for DynamicForm component
- [ ] Unit tests for NotificationBell component
- [ ] Integration test for email config flow
- [ ] Integration test for template creation
- [ ] All tests passing

---

## Next Steps After Completion

1. **Backend Review**: Ensure all 37 API endpoints working
2. **Integration Testing**: Test end-to-end flows with real providers
3. **Staging Deployment**: Deploy to staging environment
4. **Configure Webhook URLs**: Set up webhook endpoints in provider dashboards
5. **Production Testing**: Send real emails and verify webhook delivery
6. **Documentation**: Update user guides with screenshots
7. **Training**: Train support team on new features

---

**End of Frontend Module Documentation**

This document provides complete guidance for implementing the Communication/Notifications module frontend. Follow the phases sequentially, use the dynamic form pattern for provider configs, and maintain strict adherence to modern UI standards and accessibility requirements.