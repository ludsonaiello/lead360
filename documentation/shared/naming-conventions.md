# Naming Conventions

**Platform**: Lead360 Multi-Tenant SaaS CRM/ERP  
**Applies To**: Backend Agent, Frontend Agent  
**Purpose**: Consistent, readable, maintainable code

---

## General Principles

1. **Be descriptive**: Names should clearly indicate purpose
2. **Be consistent**: Follow patterns throughout codebase
3. **Avoid abbreviations**: Use full words (`customer`, not `cust`)
4. **Use common terms**: Stick to industry-standard terminology
5. **Avoid ambiguity**: `getUserById()` not `get()`

---

## Database Naming (Prisma Schema)

### **Tables**

**Convention**: `snake_case`, singular noun

```prisma
// ✅ CORRECT
model lead { }
model quote { }
model service_request { }
model time_clock_event { }

// ❌ WRONG
model Lead { }           // PascalCase
model leads { }          // Plural
model ServiceRequest { } // PascalCase
model timeClockEvent { } // camelCase
```

**Why singular?** Represents a single entity conceptually.

---

### **Columns**

**Convention**: `snake_case`

```prisma
// ✅ CORRECT
model lead {
  id         String
  tenant_id  String
  first_name String
  phone_number String
  created_at DateTime
  updated_at DateTime
}

// ❌ WRONG
model lead {
  Id         String  // PascalCase
  TenantId   String  // PascalCase
  firstName  String  // camelCase
  PhoneNumber String // PascalCase
}
```

---

### **Primary Keys**

**Convention**: Always `id`

```prisma
// ✅ CORRECT
model lead {
  id String @id @default(uuid())
}

// ❌ WRONG
model lead {
  lead_id String @id  // Don't prefix with table name
}
```

---

### **Foreign Keys**

**Convention**: `{table}_id`

```prisma
// ✅ CORRECT
model address {
  id      String @id @default(uuid())
  lead_id String
  
  lead    lead   @relation(fields: [lead_id], references: [id])
}

// ❌ WRONG
model address {
  leadId String  // camelCase
  lid    String  // Abbreviation
}
```

---

### **Boolean Columns**

**Convention**: `is_{adjective}` or `has_{noun}`

```prisma
// ✅ CORRECT
is_active     Boolean
is_default    Boolean
is_customer   Boolean
has_addresses Boolean
has_insurance Boolean

// ❌ WRONG
active        Boolean  // Ambiguous
default       Boolean  // Reserved word + ambiguous
customer      Boolean  // Unclear boolean
```

---

### **Timestamps**

**Convention**: `{action}_at`

```prisma
// ✅ CORRECT
created_at   DateTime @default(now())
updated_at   DateTime @updatedAt
deleted_at   DateTime?
sent_at      DateTime?
completed_at DateTime?

// ❌ WRONG
created      DateTime  // Incomplete
create_time  DateTime  // Inconsistent suffix
date_created DateTime  // Inconsistent prefix
```

---

### **Enum Columns**

**Convention**: `snake_case` column, `SCREAMING_SNAKE_CASE` values

```prisma
// ✅ CORRECT
enum LeadStatus {
  NEW
  QUALIFIED
  UNQUALIFIED
  CONVERTED
  LOST
}

model lead {
  status LeadStatus @default(NEW)
}

// ❌ WRONG
enum LeadStatus {
  new         // lowercase
  Qualified   // PascalCase
  un-qualified // kebab-case
}
```

---

### **Junction Tables** (Many-to-Many)

**Convention**: `{table1}_{table2}` (alphabetical order)

```prisma
// ✅ CORRECT
model project_user {
  project_id String
  user_id    String
  role       String
  
  project    project @relation(fields: [project_id], references: [id])
  user       user    @relation(fields: [user_id], references: [id])
  
  @@id([project_id, user_id])
}

// ❌ WRONG
model user_project { }  // Not alphabetical
model ProjectsUsers { } // PascalCase + plural
```

---

## Backend Naming (NestJS/TypeScript)

### **Files & Folders**

**Convention**: `kebab-case`

```
src/
├── modules/
│   ├── leads/
│   │   ├── leads.module.ts
│   │   ├── leads.controller.ts
│   │   ├── leads.service.ts
│   │   ├── dto/
│   │   │   ├── create-lead.dto.ts
│   │   │   └── update-lead.dto.ts
│   │   └── entities/
│   │       └── lead.entity.ts
│   └── time-clock/
│       └── time-clock.module.ts
```

**Why?** Unix-friendly, URL-friendly, consistent with npm packages.

---

### **Classes**

**Convention**: `PascalCase`

```typescript
// ✅ CORRECT
class LeadsController { }
class LeadsService { }
class CreateLeadDto { }
class LeadResponseDto { }
class TenantGuard { }
class PrismaService { }

// ❌ WRONG
class leadsController { }   // camelCase
class leads_controller { }  // snake_case
class LEADS_CONTROLLER { }  // SCREAMING_SNAKE_CASE
```

---

### **Interfaces & Types**

**Convention**: `PascalCase`, prefix with `I` for interfaces (optional but recommended)

```typescript
// ✅ CORRECT
interface ILead {
  id: string;
  name: string;
}

type LeadStatus = 'NEW' | 'QUALIFIED' | 'UNQUALIFIED';

interface ICreateLeadRequest {
  name: string;
  phone: string;
}

// ❌ WRONG
interface lead { }        // lowercase
interface i_lead { }      // snake_case
type leadstatus { }       // lowercase + no separation
```

---

### **Variables & Functions**

**Convention**: `camelCase`

```typescript
// ✅ CORRECT
const tenantId = '...';
const leadCount = 10;
let isActive = true;

function createLead() { }
function findLeadById() { }
async function sendNotification() { }

// ❌ WRONG
const TenantId = '...';      // PascalCase
const lead_count = 10;       // snake_case
let is_active = true;        // snake_case
function CreateLead() { }    // PascalCase
function find_lead_by_id() { } // snake_case
```

---

### **Constants**

**Convention**: `SCREAMING_SNAKE_CASE`

```typescript
// ✅ CORRECT
const API_VERSION = 'v1';
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEZONE = 'America/New_York';

const LEAD_STATUS = {
  NEW: 'NEW',
  QUALIFIED: 'QUALIFIED',
  UNQUALIFIED: 'UNQUALIFIED',
} as const;

// ❌ WRONG
const apiVersion = 'v1';     // camelCase
const max_page_size = 100;   // snake_case
const DefaultTimezone = '..'; // PascalCase
```

---

### **Private Properties**

**Convention**: Prefix with underscore `_` (optional)

```typescript
// ✅ CORRECT (both are acceptable)
class LeadsService {
  private readonly _prisma: PrismaService;
  private readonly prisma: PrismaService;
}

// Prefer without underscore for modern TypeScript
class LeadsService {
  constructor(private readonly prisma: PrismaService) {}
}
```

---

### **DTOs (Data Transfer Objects)**

**Convention**: `{Action}{Entity}Dto`

```typescript
// ✅ CORRECT
class CreateLeadDto { }
class UpdateLeadDto { }
class LeadResponseDto { }
class LeadListResponseDto { }
class CreateQuoteItemDto { }

// ❌ WRONG
class LeadDto { }            // Ambiguous (create/update/response?)
class LeadCreateDto { }      // Wrong order
class leadCreateDto { }      // camelCase
class create_lead_dto { }    // snake_case
```

---

### **Services**

**Convention**: `{Entity}Service` or `{Feature}Service`

```typescript
// ✅ CORRECT
class LeadsService { }
class QuotesService { }
class NotificationService { }
class AuthService { }
class EmailService { }

// ❌ WRONG
class ServiceLead { }        // Wrong order
class LeadSvc { }            // Abbreviation
class Leads { }              // Missing 'Service'
```

---

### **Controllers**

**Convention**: `{Entity}Controller`

```typescript
// ✅ CORRECT
class LeadsController { }
class QuotesController { }
class AuthController { }

// ❌ WRONG
class ControllerLeads { }    // Wrong order
class LeadCtrl { }           // Abbreviation
class Leads { }              // Missing 'Controller'
```

---

### **Guards**

**Convention**: `{Purpose}Guard`

```typescript
// ✅ CORRECT
class JwtAuthGuard { }
class RolesGuard { }
class TenantGuard { }

// ❌ WRONG
class AuthGuardJwt { }       // Wrong order
class GuardRoles { }         // Wrong order
```

---

### **Decorators**

**Convention**: `PascalCase` for class decorators, `camelCase` for parameter decorators

```typescript
// ✅ CORRECT
@Controller('leads')
@UseGuards(JwtAuthGuard)
class LeadsController {
  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) { }
}

// Parameter decorator
export const TenantId = createParamDecorator(...);
export const CurrentUser = createParamDecorator(...);

// ❌ WRONG
@controller('leads')         // lowercase
@use_guards(JwtAuthGuard)    // snake_case
export const tenant_id = ... // snake_case
```

---

## Frontend Naming (Next.js/React/TypeScript)

### **Files & Folders**

**Convention**: `kebab-case` for folders, `PascalCase` for component files

```
app/
├── (dashboard)/
│   ├── leads/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   └── quotes/

components/
├── leads/
│   ├── LeadsList.tsx
│   ├── LeadCard.tsx
│   └── LeadForm.tsx
└── ui/
    ├── Button.tsx
    ├── Input.tsx
    └── Modal.tsx
```

---

### **React Components**

**Convention**: `PascalCase`

```typescript
// ✅ CORRECT
export function LeadCard() { }
export function LeadForm() { }
export const Button = () => { }
export default function LeadsPage() { }

// ❌ WRONG
export function leadCard() { }    // camelCase
export function lead_card() { }   // snake_case
export function LEAD_CARD() { }   // SCREAMING_SNAKE_CASE
```

---

### **Component Props**

**Convention**: `{ComponentName}Props`, interface

```typescript
// ✅ CORRECT
interface LeadCardProps {
  lead: Lead;
  onSelect?: (id: string) => void;
}

export function LeadCard({ lead, onSelect }: LeadCardProps) { }

// ❌ WRONG
interface leadCardProps { }       // camelCase
interface LeadCardProperties { }  // Too verbose
type LeadCardProps = { }          // Use interface
```

---

### **Hooks**

**Convention**: `use{PurposeOrEntity}`

```typescript
// ✅ CORRECT
function useAuth() { }
function useLeads() { }
function useLocalStorage() { }
function useDebounce() { }

// ❌ WRONG
function getAuth() { }            // Doesn't start with 'use'
function authHook() { }           // Wrong order
function use_auth() { }           // snake_case
```

---

### **Event Handlers**

**Convention**: `handle{Event}` or `on{Event}`

```typescript
// ✅ CORRECT - Component defining handler
function LeadForm() {
  const handleSubmit = (e: FormEvent) => { };
  const handleChange = (e: ChangeEvent) => { };
  const handleDelete = () => { };
  
  return <form onSubmit={handleSubmit}>...</form>;
}

// ✅ CORRECT - Prop receiving handler
interface LeadCardProps {
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

// ❌ WRONG
const submit = () => { };         // Ambiguous
const onSubmitHandler = () => { }; // Redundant
const handleOnSubmit = () => { };  // Redundant
```

---

### **State Variables**

**Convention**: `{noun}` and `set{Noun}`

```typescript
// ✅ CORRECT
const [leads, setLeads] = useState<Lead[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [isOpen, setIsOpen] = useState(false);

// ❌ WRONG
const [lead, setLead] = useState<Lead[]>([]);  // Singular for array
const [isLoading, setLoading] = useState(false); // Inconsistent
const [err, setErr] = useState(null);          // Abbreviation
```

---

### **Boolean State Variables**

**Convention**: Prefix with `is`, `has`, `should`, `can`

```typescript
// ✅ CORRECT
const [isOpen, setIsOpen] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [hasError, setHasError] = useState(false);
const [shouldRefetch, setShouldRefetch] = useState(false);
const [canEdit, setCanEdit] = useState(true);

// ❌ WRONG
const [open, setOpen] = useState(false);       // Ambiguous
const [loading, setLoading] = useState(false); // Ambiguous
const [error, setError] = useState(false);     // Misleading (error is usually object/string)
```

---

### **API Functions**

**Convention**: `{verb}{Entity}`

```typescript
// ✅ CORRECT
export const leadsApi = {
  getAll: () => apiClient<LeadListResponse>('/leads'),
  getById: (id: string) => apiClient<Lead>(`/leads/${id}`),
  create: (data: CreateLeadDto) => apiClient<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateLeadDto) => apiClient<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiClient<void>(`/leads/${id}`, { method: 'DELETE' }),
};

// ❌ WRONG
getAllLeads() { }        // Redundant (already in leadsApi namespace)
fetchLeads() { }         // Use 'get' for consistency
removeLead() { }         // Use 'delete' for consistency
```

---

### **CSS Classes** (Tailwind)

**Convention**: Use Tailwind utility classes, avoid custom classes when possible

```typescript
// ✅ CORRECT
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h2 className="text-lg font-semibold text-gray-900">Title</h2>
</div>

// If custom class needed, use kebab-case
<div className="custom-card-layout">
```

---

### **Environment Variables**

**Convention**: `SCREAMING_SNAKE_CASE`, prefix with `NEXT_PUBLIC_` for client-side

```env
# ✅ CORRECT
NEXT_PUBLIC_API_URL=https://api.lead360.app/api/v1
NEXT_PUBLIC_APP_URL=https://app.lead360.app
DATABASE_URL=mysql://...
JWT_SECRET=...

# ❌ WRONG
apiUrl=...              # camelCase
next_public_api_url=... # lowercase
NextPublicApiUrl=...    # PascalCase
```

---

## API Endpoint Naming

### **Resource Paths**

**Convention**: `kebab-case`, plural nouns

```
// ✅ CORRECT
/api/v1/leads
/api/v1/quotes
/api/v1/service-requests
/api/v1/time-clock-events

// ❌ WRONG
/api/v1/lead              # Singular
/api/v1/Leads             # PascalCase
/api/v1/service_requests  # snake_case
/api/v1/timeClockEvents   # camelCase
```

---

### **Action Endpoints**

**Convention**: `kebab-case` verb

```
// ✅ CORRECT
POST /api/v1/quotes/:id/send
POST /api/v1/quotes/:id/accept
POST /api/v1/invoices/:id/void
POST /api/v1/projects/:id/mark-complete

// ❌ WRONG
POST /api/v1/quotes/:id/Send       # PascalCase
POST /api/v1/quotes/:id/sendQuote  # camelCase
POST /api/v1/quotes/:id/send_quote # snake_case
```

---

## Git Commit Messages

**Convention**: `type(scope): subject`

```
// ✅ CORRECT
feat(leads): add lead creation API endpoint
fix(quotes): correct tax calculation rounding error
docs(api): update authentication documentation
test(leads): add tenant isolation tests
refactor(auth): simplify JWT validation logic

// Types: feat, fix, docs, style, refactor, test, chore

// ❌ WRONG
Added lead creation              # No type
fix: fixed bug                   # Too vague
FEAT(LEADS): NEW ENDPOINT        # All caps
```

---

## Branch Naming

**Convention**: `{type}/{description-in-kebab-case}`

```
// ✅ CORRECT
feature/leads-module-backend
feature/leads-module-frontend
fix/tenant-isolation-bug
docs/api-documentation-leads
refactor/auth-middleware

// ❌ WRONG
new-feature                      # No type
feature/LeadsModule              # PascalCase
fix_tenant_bug                   # snake_case
feature/leads module             # Spaces
```

---

## Acronyms & Abbreviations

### **Avoid Abbreviations**

Use full words for clarity:

```typescript
// ✅ CORRECT
const customer = ...;
const request = ...;
const configuration = ...;

// ❌ WRONG
const cust = ...;
const req = ...;
const config = ...;  // Exception: 'config' is widely accepted
```

---

### **Common Acceptable Abbreviations**

- `id` (identifier)
- `url` (uniform resource locator)
- `api` (application programming interface)
- `jwt` (JSON web token)
- `sms` (short message service)
- `pdf` (portable document format)
- `uuid` (universally unique identifier)

---

### **Acronyms in Code**

**Convention**: All lowercase or all uppercase depending on context

```typescript
// ✅ CORRECT
const apiUrl = '...';           // camelCase: all lowercase
const API_URL = '...';          // Constant: all uppercase
class APIClient { }             // Class: all uppercase
const smsMessage = '...';       // camelCase: all lowercase

// ❌ WRONG
const apiURL = '...';           // Mixed case in variable
const aPIUrl = '...';           // Awkward capitalization
```

---

## Summary

**Quick Reference**:

| Context | Convention | Example |
|---------|------------|---------|
| Database tables | snake_case, singular | `lead`, `service_request` |
| Database columns | snake_case | `tenant_id`, `created_at` |
| Files/folders | kebab-case | `leads.service.ts`, `create-lead.dto.ts` |
| Classes | PascalCase | `LeadsService`, `CreateLeadDto` |
| Variables/functions | camelCase | `tenantId`, `createLead()` |
| Constants | SCREAMING_SNAKE_CASE | `API_VERSION`, `MAX_PAGE_SIZE` |
| React components | PascalCase | `LeadCard`, `LeadForm` |
| Hooks | use{Name} | `useAuth()`, `useLeads()` |
| API paths | kebab-case, plural | `/leads`, `/service-requests` |
| Environment vars | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `NEXT_PUBLIC_API_URL` |

---

**End of Naming Conventions**

Consistency is key. When in doubt, look at existing code and follow the pattern.