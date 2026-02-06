🚀 PROCEEDING WITH FRONTEND IMPLEMENTATION GUIDE
Generating comprehensive frontend implementation documentation...

🎨 FRONTEND IMPLEMENTATION GUIDE: TWILIO SMS/CALLS COMMUNICATION PROVIDER
Document Version: 1.0
Last Updated: February 5, 2026
Owner: Ludson (Project Manager)
Status: READY FOR DEVELOPMENT
Prerequisites:

Feature Contract v1.0 (approved)
Backend Implementation Guide v1.0 (approved)


1. DOCUMENT PURPOSE
This guide defines the frontend architecture, component structure, user flows, and UI requirements for the Twilio SMS/Calls Communication Provider feature.
Audience:

Frontend developers implementing the feature
UI/UX designers reviewing user flows
QA engineers designing UI test cases
Product managers validating user experience

What This Document Contains:

Component structure and responsibilities
User flows and interaction patterns
Screen specifications and layout requirements
Form validation rules
State management requirements
API integration patterns
Error handling and user feedback
Responsive design considerations
Accessibility requirements
Testing requirements

What This Document Does NOT Contain:

React/Next.js code or implementation
Specific CSS or styling code
Component library specifics (shadcn/ui usage)
State management code (Redux, Zustand, etc.)


2. ARCHITECTURE OVERVIEW
2.1 Application Structure
The frontend is organized into feature-based modules following existing Lead360 patterns:
Feature Module: Communication/Twilio
Page Routes:

/settings/communication/twilio → Twilio provider configuration
/settings/communication/ivr → IVR menu configuration
/settings/communication/whitelist → Office number whitelist management
/communication/history → Unified call/SMS history
/leads/:id → Lead detail (enhanced with call/SMS actions)

Component Hierarchy:
Communication Module
├── Configuration
│   ├── TwilioSetupWizard
│   ├── TwilioConfigurationForm
│   └── ModelSelectionCard
├── IVR
│   ├── IvrConfigurationForm
│   ├── IvrMenuBuilder
│   └── IvrActionEditor
├── Whitelist
│   ├── WhitelistManager
│   ├── WhitelistTable
│   └── AddNumberModal
├── History
│   ├── CommunicationHistoryView
│   ├── HistoryFilters
│   ├── HistoryTable
│   └── HistoryDetailModal
├── Call
│   ├── InitiateCallModal
│   ├── CallRecordingPlayer
│   └── CallTranscriptionViewer
├── SMS
│   ├── SendSmsModal
│   └── SmsThreadView
└── Shared
    ├── PhoneNumberInput
    ├── E164Display
    └── CallStatusBadge
2.2 State Management Strategy
Local State (Component-Level):

Form inputs and validation
Modal open/close state
UI toggles and temporary data

Global State (Application-Level):

Current tenant configuration status
User permissions for communication features
Active call/SMS counts (for notifications)

Server State (React Query/SWR):

Twilio configuration data
IVR configuration data
Call/SMS history
Lead data
Recording URLs

Cache Strategy:

Configuration data: Cache for 5 minutes
History data: Cache for 1 minute, invalidate on mutations
Recording URLs: Do NOT cache (signed URLs expire)

2.3 Responsive Design Approach
Breakpoints:

Mobile: < 640px
Tablet: 640px - 1024px
Desktop: > 1024px

Layout Patterns:

Mobile: Single column, collapsible sections, bottom sheets for modals
Tablet: Two-column where appropriate, side panels
Desktop: Multi-column layouts, inline modals, sidebar navigation

Priority Content:

Mobile: Focus on actions (call/SMS buttons), critical data only
Desktop: Full data tables, expanded details, multi-panel views


3. USER ROLES & PERMISSIONS
3.1 Role-Based UI Display
System Admin:

Sees all tenant configurations
Can switch between tenant views
Access to admin-only pages (usage reports, failed transcriptions)

Tenant Admin:

Sees all configuration pages
Can modify Twilio, IVR, whitelist settings
Full access to call/SMS history
Can view usage reports for own tenant

Tenant User (with permissions):

Can send SMS and make calls
Can view call/SMS history
Can playback recordings
Can view transcriptions
CANNOT access configuration pages

Tenant User (no permissions):

No access to Communication module
No call/SMS actions visible on Lead detail page

3.2 Permission-Based Feature Rendering
UI Components Must Check Permissions:

Call Button on Lead: Show only if user has communication.calls.make
SMS Button on Lead: Show only if user has communication.sms.send
History View: Show only if user has communication.history.view
Configuration Pages: Show only if user has communication.twilio.configure, communication.ivr.manage, etc.
Recording Playback: Show only if user has communication.recordings.access
Transcription View: Show only if user has communication.transcriptions.view

Navigation Menu:

Communication menu items only visible if user has at least one communication permission
Settings submenu (Twilio, IVR, Whitelist) only visible to Tenant Admin


4. SCREEN SPECIFICATIONS
4.1 Twilio Provider Configuration
Route: /settings/communication/twilio
Purpose: Configure Twilio provider for tenant (initial setup or model switching)
Access: Tenant Admin only
Layout:
If No Configuration Exists (First-Time Setup):
Header Section:

Page title: "Setup Twilio Communication"
Subtitle: "Connect your Twilio account or use our managed service to enable SMS and voice calls"
Help icon with tooltip: "Learn more about Twilio setup"

Setup Wizard (Multi-Step):
Step 1: Choose Deployment Model

Card layout with two options:
Option A: Use My Own Twilio Account

Icon: External link
Description: "Bring your own Twilio account. You pay Twilio directly and have full control."
Pros list: "Your existing phone number", "Direct billing with Twilio", "Full account access"
Button: "Configure My Account"

Option B: Use Lead360 Managed Service

Icon: Cloud
Description: "We provision a phone number for you. Simpler setup, usage tracked internally."
Pros list: "No Twilio account needed", "Phone number provided", "Centralized billing"
Button: "Request Managed Number"



Step 2A: Configure Own Account (Model A)
Form Fields:

Twilio Account SID (required)

Input type: Password (masked)
Placeholder: "AC... (32 characters)"
Validation: Must start with "AC", exactly 32 chars
Help text: "Find this in your Twilio Console under Account Info"


Twilio Auth Token (required)

Input type: Password (masked)
Placeholder: "32-character token"
Validation: Exactly 32 chars, alphanumeric
Help text: "Found in Twilio Console. Keep this secret!"


Phone Number (required)

Input component: PhoneNumberInput (custom component with country code selector)
Format display: E.164 (+1XXXXXXXXXX)
Validation: Must be valid E.164 format
Help text: "Your active Twilio phone number"



Actions:

Button: "Test Connection" (validates credentials without saving)
Button: "Save Configuration"
Link: "Back to model selection"

Test Connection Flow:

Click "Test Connection" → Loading spinner
Backend validates credentials, tests Twilio API
Success: Green checkmark, message "Connection successful!"
Failure: Red error message with specific issue (e.g., "Invalid Account SID")

Step 2B: Request Managed Number (Model B)
Display:

Info box: "A phone number will be provisioned for you from our Twilio account."
Loading state while provisioning (if immediate)
Success state: "Your number has been assigned: +1XXXXXXXXXX"

Actions:

Button: "Activate Managed Service"
Link: "Back to model selection"

Step 3: Confirmation

Success message: "Twilio configured successfully!"
Display configured phone number
Display webhook URLs (for user reference if Model A)
Info box: "Webhooks have been automatically configured in your Twilio account" (Model A) or "Your managed number is ready to use" (Model B)
Button: "Continue to IVR Setup" (optional next step)
Button: "Go to Dashboard"

If Configuration Already Exists:
Display Current Configuration:
Configuration Card:

Deployment Model badge: "Own Account" or "Managed Service"
Phone number: Display with copy button
Status badge: Active (green), Inactive (gray), Suspended (red)
Last synced: Timestamp of last usage sync
Webhook URLs: Collapsible section showing all webhook endpoints

Actions:

Button: "Switch to [Other Model]" (e.g., "Switch to Managed Service")
Button: "Deactivate" (with confirmation dialog)
Button: "Edit Configuration" (Model A only - update credentials)

Usage Summary (Optional Display):

Total calls this month
Total SMS this month
Total duration
Estimated cost (if Model B)

Error States:

Configuration inactive: Warning banner "Your Twilio provider is inactive. Calls and SMS will not work."
Credentials invalid (Model A): Error banner "Unable to connect to Twilio. Please check your credentials."
System issues: Error banner with contact support link


4.2 IVR Configuration
Route: /settings/communication/ivr
Purpose: Configure IVR menu for inbound calls
Access: Tenant Admin only
Layout:
Header Section:

Page title: "IVR Menu Configuration"
Subtitle: "Customize the automated menu that customers hear when they call"
Help icon with tooltip: "IVR directs callers to the right resource"

IVR Enable Toggle:

Switch: "Enable IVR Menu"
Help text: "When disabled, calls route directly to your default handler"

If IVR Disabled:

Display info box: "IVR is currently disabled. Inbound calls will route directly to [default handler]."
Show only the enable toggle
No further configuration visible

If IVR Enabled:
Greeting Message Section:

Label: "Greeting Message"
Textarea: Enter greeting text (e.g., "Thank you for calling [Business Name]. Please select from the following options.")
Character limit: 500 characters
Help text: "This message plays before the menu options"
Future enhancement indicator: "Audio upload coming soon" (grayed out)

Menu Options Builder:
Drag-and-Drop List (Visual Builder):

List of menu options (0-9)
Each option displayed as a card:
Menu Option Card:

Digit Badge: Large digit (e.g., "1") on left side
Label: Text input (e.g., "Request a quote")
Action Type: Dropdown with 4 options:

"Route to Phone Number"
"Route to Default/Queue"
"Trigger Webhook"
"Save as Voicemail"


Action Configuration: Conditional fields based on action type:

If "Route to Phone Number": PhoneNumberInput component
If "Route to Default/Queue": Display default number (from tenant settings)
If "Trigger Webhook": URL input (HTTPS validation)
If "Save as Voicemail": No additional config


Actions: Drag handle (left), Delete button (right)



Add Menu Option Button:

Button: "+ Add Option"
Disabled if 10 options already exist
Adds new option with next available digit (0-9)

Menu Options Constraints:

Maximum 10 options (digits 0-9)
Each digit must be unique
Visual feedback if trying to add more than 10

Advanced Settings (Collapsible Section):

Default Action: What happens if no input or invalid input

Dropdown: Same 4 action types as menu options
Configuration fields based on selected action


Timeout (seconds): Number input (range: 5-60)

Help text: "How long to wait for caller input"


Max Retries: Number input (range: 1-5)

Help text: "How many times to repeat the menu before executing default action"



Actions:

Button: "Save IVR Configuration"
Button: "Preview" (future: play sample IVR flow)
Link: "Cancel"

Preview/Test Mode (Future Enhancement):

Visual flow diagram showing menu structure
Test mode: Simulate IVR flow without making real call

Error States:

Invalid phone number in any option: Inline error below field
Invalid webhook URL: Inline error "Must be HTTPS URL"
Duplicate digits: Error message "Each digit must be unique"
No options configured but IVR enabled: Warning "Add at least one menu option"


4.3 Office Number Whitelist Management
Route: /settings/communication/whitelist
Purpose: Manage office numbers that bypass IVR
Access: Tenant Admin only
Layout:
Header Section:

Page title: "Office Number Whitelist"
Subtitle: "Numbers on this list skip the IVR menu and can make outbound calls using your business number"
Help icon with tooltip: "Use this for employee phones that need quick access"

Whitelist Table:
Columns:

Phone Number (E.164 display with formatting)
Label (e.g., "John's Mobile", "Office Desk 1")
Status (Active badge or Inactive badge)
Added (Date added)
Actions (Edit, Delete icons)

Table Features:

Search: Filter by phone number or label
Sort: By added date, label
Pagination: 20 items per page
Empty state: "No office numbers added yet. Add your first number to get started."

Add Number Button:

Button: "+ Add Office Number" (top right)
Opens modal

Add Office Number Modal:
Form Fields:

Phone Number (required)

Component: PhoneNumberInput
Validation: E.164 format, not already in whitelist


Label (required)

Text input
Placeholder: "e.g., John's Mobile"
Max length: 100 characters



Actions:

Button: "Add Number"
Button: "Cancel"

Edit Office Number Modal:

Same form fields as Add modal
Pre-filled with existing data
Cannot change phone number (display only)
Can update label
Can toggle Active/Inactive status

Delete Confirmation Dialog:

Message: "Remove [phone number] from whitelist?"
Warning: "This number will no longer bypass the IVR menu."
Actions: "Remove", "Cancel"

Error States:

Duplicate number: Error "This number is already whitelisted"
Invalid format: Error "Invalid phone number format"


4.4 Lead Detail Page (Enhanced)
Route: /leads/:id
Purpose: View and manage Lead details, now enhanced with call/SMS capabilities
Access: All tenant users (actions depend on permissions)
Enhancements to Existing Page:
Communication Action Bar (New Section):
Location: Below Lead header, above existing tabs
Layout:

Horizontal action bar with icon buttons
Button: "📞 Call" (if user has communication.calls.make permission)
Button: "💬 SMS" (if user has communication.sms.send permission)
Display: Last contact indicator (e.g., "Last call: 2 hours ago")

If No Permissions:

Action bar not visible

Communication Tab (New Tab):
Tab Navigation:

Existing tabs: "Details", "Activity", "Quotes", etc.
New tab: "Communication" (shows call/SMS history for this Lead only)

Communication Tab Content:
Timeline View:

Chronological list of all calls and SMS for this Lead
Each item displayed as a card:

Call Item Card:

Icon: Phone (inbound/outbound indicator)
Direction: "Inbound Call" or "Outbound Call"
Date/Time: "Feb 5, 2026 at 2:30 PM"
Duration: "5 minutes 32 seconds"
Status badge: Completed, Failed, No Answer, etc.
Initiated by: User name (if outbound)
Call reason: Text (if outbound)
Actions:

Button: "▶ Play Recording" (if available)
Button: "📄 View Transcription" (if available)



SMS Item Card:

Icon: Message bubble (inbound/outbound indicator)
Direction: "Inbound SMS" or "Outbound SMS"
Date/Time: "Feb 5, 2026 at 2:25 PM"
Message preview: First 100 characters
Sent by: User name (if outbound)
Status badge: Delivered, Failed, etc.
Click to expand: Show full message

Empty State:

Message: "No communication history yet"
Prompt: "Use the buttons above to call or send SMS to this Lead"

Filters:

Filter by type: All, Calls Only, SMS Only
Filter by direction: All, Inbound, Outbound
Date range picker


4.5 Call Action Flow
Trigger: User clicks "📞 Call" button on Lead detail page
Modal: "Initiate Call"
Layout:
Header:

Title: "Call [Lead Name]"
Lead phone number displayed prominently

Form Fields:
1. Your Phone Number (required):

Component: PhoneNumberInput
Label: "Which number should we call you on?"
Placeholder: User's default phone (if stored in profile)
Help text: "We'll call this number first, then connect you to the Lead"
Validation: Valid E.164 format

2. Call Reason (required):

Component: Textarea
Label: "What's the purpose of this call?"
Placeholder: "e.g., Following up on quote request"
Character limit: 500 characters
Help text: "This will be logged for reference"

Info Box:

Icon: Info
Message: "We'll call you first. Once you answer, we'll connect you to [Lead Name]. Both parties will be notified that the call is recorded."

Actions:

Button: "Start Call" (primary, green)
Button: "Cancel"

Loading State:

After clicking "Start Call"
Spinner with message: "Initiating call..."
Progress updates:

"Calling your number: [user phone]..."
"Waiting for you to answer..."
"Connecting to [Lead Name]..."



Success State:

Message: "Call connected!"
Subtext: "You can now talk with [Lead Name]"
Info: "Call is being recorded and will appear in the Communication history"
Button: "Close"

Error States:

User doesn't answer: "We couldn't reach you at [user phone]. Please check the number and try again."
Lead doesn't answer: "Unable to reach [Lead Name]. Call logged as 'No Answer'."
Twilio API error: "Unable to initiate call. Please try again or contact support."


4.6 SMS Action Flow
Trigger: User clicks "💬 SMS" button on Lead detail page
Modal: "Send SMS"
Layout:
Header:

Title: "Send SMS to [Lead Name]"
Lead phone number displayed

Form Fields:
Message Body (required):

Component: Textarea
Label: "Message"
Placeholder: "Type your message..."
Character counter: "0 / 1600 characters"
Help text: "Standard SMS rates apply (up to 1600 characters)"

Template Dropdown (Optional):

Dropdown: "Use a template" (if SMS templates exist - future feature)
Options: List of saved message templates
Selecting template auto-fills message body

Info Box:

Icon: Info
Message: "Message will be sent from your business number: [tenant Twilio number]"

Actions:

Button: "Send SMS" (primary, blue)
Button: "Cancel"

Loading State:

Spinner with message: "Sending SMS..."

Success State:

Message: "SMS sent to [Lead Name]!"
Subtext: "Message logged in Communication history"
Button: "Send Another" or "Close"

Error States:

Message empty: Inline validation "Message cannot be empty"
Message too long: Inline validation "Message exceeds 1600 characters"
Twilio API error: "Failed to send SMS. Please try again or contact support."
Lead phone number invalid: "Unable to send SMS. Lead's phone number appears to be invalid."


4.7 Communication History View
Route: /communication/history
Purpose: View all call/SMS activity for the tenant (all Leads)
Access: Users with communication.history.view permission
Layout:
Header Section:

Page title: "Communication History"
Subtitle: "All calls and SMS for your organization"

Filter Panel (Left Sidebar or Top Bar):
Filters:

Type: Checkboxes for "Calls" and "SMS"
Direction: Radio buttons for "All", "Inbound", "Outbound"
Status: Dropdown with status options (Completed, Failed, No Answer, Delivered, etc.)
Lead: Autocomplete search for Lead name
Date Range: Date picker (From - To)
User: Dropdown to filter by user who initiated (for outbound)

Actions:

Button: "Apply Filters"
Link: "Clear All Filters"

History Table/List:
Table Columns:

Type Icon: Phone or message bubble icon
Lead: Lead name (clickable → navigates to Lead detail)
Direction: Inbound/Outbound badge
Phone Number: Lead's phone number
Date/Time: Timestamp
Duration/Status: Call duration or SMS delivery status
User: Who initiated (if outbound), or "—" if inbound
Actions: Quick action icons

Call: Play recording icon (if available)
Call: View transcription icon (if available)
SMS: Expand message icon



Table Features:

Sort: By date (default: newest first), Lead name, duration
Pagination: 100 items per page
Export: Button to export as CSV (future feature)

Empty State:

Message: "No communication history found"
Subtext: "Calls and SMS will appear here once you start using the system"

Row Click Behavior:

Clicking a row opens detail modal

Detail Modal (Call):

Lead name and phone number
Call date/time
Direction, duration, status
Initiated by (if outbound)
Call reason (if outbound)
Recording player (if available) - see section 4.8
Transcription viewer (if available) - see section 4.9
Button: "View Lead Details" (navigates to Lead page)

Detail Modal (SMS):

Lead name and phone number
SMS date/time
Direction, status
Sent by (if outbound)
Full message body
Button: "Reply" (opens Send SMS modal)
Button: "View Lead Details"


4.8 Call Recording Player
Component: CallRecordingPlayer
Purpose: Playback call recordings with speed controls
Locations Used:

Communication History detail modal
Lead Communication tab

Layout:
Player UI:
Waveform/Progress Bar:

Visual waveform representation (simple progress bar acceptable)
Current time / Total duration display (e.g., "1:25 / 5:32")
Draggable seek slider

Controls:

Play/Pause Button: Toggle playback
Playback Speed: Dropdown with options: 0.5x, 1x, 2x

Icon indicator showing current speed


Volume Slider: Standard volume control
Download Button: Download recording as file

Loading States:

While fetching recording URL: Spinner with "Loading recording..."
While recording is being generated (status: PENDING): Message "Recording is being processed. Please check back in a few minutes."

Error States:

Recording not available: "Recording not available for this call"
Recording failed: "Recording failed to generate. Please contact support."
URL expired: "Recording link expired. Refreshing..." (auto-retry)

Accessibility:

Keyboard controls: Space (play/pause), Left/Right arrows (seek), Up/Down (volume)
Screen reader labels for all controls
ARIA live region for time updates


4.9 Call Transcription Viewer
Component: CallTranscriptionViewer
Purpose: Display and search call transcriptions
Locations Used:

Communication History detail modal
Lead Communication tab

Layout:
Header:

Title: "Call Transcription"
Metadata: Language detected, confidence score (e.g., "English - 98% confidence")

Transcription Text:

Display full transcription text
Scrollable container (max height with scroll)
Monospace or readable font
Paragraph breaks for readability (if provided by transcription service)

Search Within Transcription:

Search input: "Find in transcription..."
Highlights matching text as user types
Next/Previous buttons to navigate matches
Match counter: "2 of 5 matches"

Actions:

Button: "Copy Transcription" (copies text to clipboard)
Button: "Download as Text" (downloads .txt file)

Loading States:

Status: QUEUED or PROCESSING: Message "Transcription is being generated. This usually takes up to 30 minutes."

Show estimated time remaining (if available)
Refresh button to check status



Error States:

Transcription failed: "Transcription failed to generate. Error: [error message]"

Button: "Retry Transcription" (if retry is supported)


Transcription not available: "Transcription not available for this call"

Empty State:

If call has no transcription: "No transcription available for this call"


4.10 Admin Usage Dashboard
Route: /admin/communication/usage
Purpose: View aggregated usage across all tenants (System Admin only)
Access: System Admin only
Layout:
Header Section:

Page title: "Twilio Usage Dashboard"
Subtitle: "Monitor communication usage across all tenants"

Date Range Selector:

Dropdown: "This Month", "Last Month", "Last 30 Days", "Custom Range"
If Custom: Date picker (From - To)

Summary Cards (Top Row):
Card 1: Total Calls

Large number: Total calls across all tenants
Breakdown: Inbound vs Outbound
Trend indicator: +/- % vs previous period

Card 2: Total SMS

Large number: Total SMS across all tenants
Breakdown: Inbound vs Outbound
Trend indicator: +/- % vs previous period

Card 3: Total Duration

Large number: Total call minutes
Average call duration
Trend indicator: +/- % vs previous period

Card 4: Total Cost

Large number: Estimated total cost (for Model B tenants)
Cost breakdown by tenant (top 5)
Trend indicator: +/- % vs previous period

Tenant Usage Table:
Columns:

Tenant Name
Model (Own Account / Managed Service)
Phone Number
Calls (count)
SMS (count)
Duration (minutes)
Cost (estimated, if Model B)
Status (Active, Inactive, Suspended)

Table Features:

Search: Filter by tenant name
Sort: By any column
Export: "Export to CSV"
Click row: Navigate to tenant detail view

Charts (Optional):

Line chart: Usage over time (calls, SMS, duration)
Pie chart: Usage by tenant (top 10)
Bar chart: Cost by tenant (Model B only)


4.11 Admin Failed Transcriptions
Route: /admin/communication/transcriptions/failed
Purpose: View and debug failed transcriptions (System Admin only)
Access: System Admin only
Layout:
Header Section:

Page title: "Failed Transcriptions"
Subtitle: "Debug transcription issues and retry failed jobs"

Failed Transcriptions Table:
Columns:

Tenant Name
Call Date
Lead Name
Provider (e.g., "openai_whisper")
Error Message (truncated, expandable)
Attempts (number of retry attempts)
Last Attempt (timestamp)
Actions (Retry button, View details link)

Table Features:

Filter by provider
Filter by error type (if categorized)
Sort by last attempt (newest first)
Pagination: 50 items per page

Row Actions:

Button: "Retry" (re-queues transcription job)
Link: "View Call Details" (opens call record)

Bulk Actions:

Checkbox selection
Button: "Retry Selected" (bulk retry)

Empty State:

Message: "No failed transcriptions"
Subtext: "All transcriptions are processing successfully"


5. FORM VALIDATION RULES
5.1 Phone Number Validation
Component: PhoneNumberInput (custom reusable component)
Validation Rules:

Required: If field is marked required
Format: Must be valid E.164 format after normalization
Country Code: Must include valid country code (default: +1 for U.S.)
Length: 10-15 digits (excluding country code prefix "+")

User Input Handling:

Accept various formats: (978) 896-8047, 978-896-8047, 9788968047
Auto-format as user types (add parentheses, dashes for display)
Normalize to E.164 before submission (+19788968047)
Display formatted for readability in UI

Error Messages:

Empty (when required): "Phone number is required"
Invalid format: "Please enter a valid phone number"
Invalid country code: "Please select a valid country code"

Component Features:

Country code dropdown (flag + code, e.g., 🇺🇸 +1)
Auto-detect country from tenant settings (default)
Format display as user types
Clear button to reset input


5.2 Twilio Configuration Form Validation
Account SID:

Required: Yes
Format: Must start with "AC", exactly 32 characters
Pattern: ^AC[a-zA-Z0-9]{32}$
Error: "Account SID must start with 'AC' and be exactly 32 characters"

Auth Token:

Required: Yes
Length: Exactly 32 characters
Pattern: ^[a-zA-Z0-9]{32}$
Error: "Auth Token must be exactly 32 alphanumeric characters"

Phone Number:

Required: Yes
Format: E.164 (use PhoneNumberInput component)
Error: "Please enter a valid phone number in international format"

Form-Level Validation:

Test connection before allowing save
All fields must pass validation before "Save" button is enabled


5.3 IVR Configuration Form Validation
Greeting Message:

Required: If IVR enabled
Max Length: 500 characters
Error: "Greeting message cannot exceed 500 characters"

Menu Options:

Required: At least 1 option if IVR enabled
Max Options: 10 (digits 0-9)
Unique Digits: Each digit must be unique
Error: "Each menu option must have a unique digit (0-9)"

Menu Option - Label:

Required: Yes for each option
Max Length: 100 characters
Error: "Label is required" or "Label cannot exceed 100 characters"

Menu Option - Action Configuration:
If Action = "Route to Phone Number":

Phone Number Required: Yes
Format: E.164 (use PhoneNumberInput component)
Error: "Valid phone number is required"

If Action = "Trigger Webhook":

URL Required: Yes
Format: Must be valid HTTPS URL
Pattern: ^https://.*
Error: "Webhook URL must be a valid HTTPS URL"

If Action = "Route to Default" or "Save as Voicemail":

No additional validation

Timeout Seconds:

Required: Yes
Range: 5-60
Error: "Timeout must be between 5 and 60 seconds"

Max Retries:

Required: Yes
Range: 1-5
Error: "Max retries must be between 1 and 5"


5.4 Office Whitelist Form Validation
Phone Number:

Required: Yes
Format: E.164 (use PhoneNumberInput component)
Unique: Must not already exist in whitelist for this tenant
Error: "This phone number is already whitelisted"

Label:

Required: Yes
Max Length: 100 characters
Error: "Label is required" or "Label cannot exceed 100 characters"


5.5 Call Initiation Form Validation
User Phone Number:

Required: Yes
Format: E.164 (use PhoneNumberInput component)
Error: "Please enter a valid phone number where we can reach you"

Call Reason:

Required: Yes
Max Length: 500 characters
Error: "Call reason is required" or "Call reason cannot exceed 500 characters"


5.6 SMS Form Validation
Message Body:

Required: Yes
Max Length: 1600 characters (SMS limit)
Error: "Message cannot be empty" or "Message exceeds 1600 characters"

Character Counter:

Display live count: "1234 / 1600 characters"
Warning at 1500 characters: Yellow indicator
Error at 1600 characters: Red indicator, disable send button


6. STATE MANAGEMENT REQUIREMENTS
6.1 Configuration State
Twilio Configuration State:

Data: Current tenant's Twilio configuration
Source: API endpoint /api/communication/twilio/configuration
Cache: 5 minutes
Invalidation: After save, switch model, or deactivate

IVR Configuration State:

Data: Current tenant's IVR configuration
Source: API endpoint /api/communication/ivr/configuration
Cache: 5 minutes
Invalidation: After save

Office Whitelist State:

Data: List of whitelisted office numbers
Source: API endpoint /api/communication/office-whitelist
Cache: 5 minutes
Invalidation: After add, edit, or delete


6.2 History State
Communication History State:

Data: Paginated list of calls and SMS
Source: API endpoint /api/communication/history
Cache: 1 minute
Invalidation: After new call/SMS, after filter change
Pagination: Client-side or server-side (recommend server-side for large datasets)

Lead Communication State:

Data: Calls and SMS for specific Lead
Source: API endpoint /api/communication/history?lead_id=...
Cache: 1 minute
Invalidation: After new call/SMS to this Lead


6.3 Recording State
Recording URL State:

Data: Signed URL for recording playback
Source: API endpoint /api/communication/call/:id/recording
Cache: DO NOT CACHE (signed URLs expire)
Fetch: On-demand when user clicks play

Transcription State:

Data: Transcription text and metadata
Source: API endpoint /api/communication/call/:id/transcription
Cache: 5 minutes
Polling: If status is QUEUED or PROCESSING, poll every 30 seconds for updates


6.4 User Permissions State
Permissions State:

Data: Current user's communication permissions
Source: Authenticated user session (from backend)
Cache: Session lifetime
Invalidation: On login/logout

Permission Checks:

Check permissions before rendering UI elements (buttons, pages, etc.)
Re-validate permissions on API calls (backend enforces, frontend displays appropriately)


6.5 Modal and UI State
Modal States:

Open/close state for all modals (call, SMS, add whitelist, etc.)
Form input state within modals
Loading states during API calls
Error states for failed operations

UI Toggles:

Filter panel collapsed/expanded (history view)
IVR enabled/disabled toggle
Menu option cards collapsed/expanded


7. API INTEGRATION PATTERNS
7.1 API Call Strategy
Use React Query or SWR for:

Fetching configuration data
Fetching history data
Caching and automatic refetching

Use Standard Fetch/Axios for:

One-time mutations (send SMS, initiate call)
File downloads (recording download)

Error Handling Pattern:

Catch API errors in hooks/services
Display user-friendly error messages
Log technical errors to console (dev) or error tracking service (prod)


7.2 Loading States
Page-Level Loading:

Show skeleton loaders for tables and cards while data fetches
Display spinner with message for slow operations (e.g., "Loading communication history...")

Component-Level Loading:

Button loading state: Disable button, show spinner inside button during API call
Inline spinners for partial page updates

Optimistic Updates:

When adding office number: Immediately add to table, rollback if API fails
When sending SMS: Immediately show "Sending..." status, update to "Sent" or "Failed" after API response


7.3 Error Display
Toast Notifications:

Success: "SMS sent successfully!"
Error: "Failed to send SMS. Please try again."
Info: "Transcription is being generated. Check back in a few minutes."

Inline Errors:

Form validation errors: Display below input field in red
API errors: Display in alert box above form

Error Retry:

For transient errors (network timeout), show "Retry" button
For permanent errors (invalid data), show "Edit" option


8. RESPONSIVE DESIGN REQUIREMENTS
8.1 Mobile Optimization (< 640px)
Navigation:

Bottom navigation bar (if using mobile app pattern)
Hamburger menu for settings pages

Twilio Configuration:

Single-column form layout
Collapse sections into accordions
Model selection cards stacked vertically

IVR Configuration:

Menu options displayed as list (not drag-and-drop on mobile)
Edit each option by tapping, opens full-screen modal

History View:

Card layout instead of table
Each call/SMS as a card with key details
Tap to expand for full details

Call/SMS Actions:

Large, thumb-friendly buttons
Bottom sheet modals (slide up from bottom) instead of centered modals

Recording Player:

Full-width player
Larger controls for touch targets


8.2 Tablet Optimization (640px - 1024px)
Navigation:

Side navigation panel (collapsible)
Settings pages accessible via sidebar

Twilio Configuration:

Two-column layout where appropriate (form on left, help text on right)

IVR Configuration:

Two-column: Menu options on left, preview on right (future)

History View:

Table layout with fewer columns (hide less important data)
Sticky header row

Call/SMS Actions:

Side panel modals (slide in from right)


8.3 Desktop Optimization (> 1024px)
Navigation:

Full sidebar navigation always visible

Twilio Configuration:

Multi-step wizard with progress indicator at top
Form fields side-by-side where logical

IVR Configuration:

Drag-and-drop menu builder
Live preview panel on right side

History View:

Full data table with all columns
Inline detail expansion (no modal, expand row)

Call/SMS Actions:

Centered modals
Larger modal size for better readability


9. ACCESSIBILITY REQUIREMENTS
9.1 Keyboard Navigation
All Interactive Elements:

Must be accessible via Tab key
Logical tab order (top to bottom, left to right)
Focus indicators clearly visible (outline, highlight)

Modals:

Focus traps: Tabbing stays within modal until closed
Escape key closes modal
First focusable element receives focus on open

Forms:

Enter key submits form (if no conflicts)
Arrow keys navigate between options in dropdowns, radio groups

Recording Player:

Space: Play/pause
Left/Right arrows: Seek backward/forward
Up/Down arrows: Volume up/down


9.2 Screen Reader Support
ARIA Labels:

All icon-only buttons must have aria-label
Example: "Play recording" button (has play icon, no text)

ARIA Live Regions:

Status updates: "SMS sent", "Call connecting", "Transcription ready"
Error messages: Announced immediately

Form Labels:

All form inputs must have associated <label> or aria-label
Error messages linked via aria-describedby

Table Headers:

Proper <th> tags with scope="col"
Data cells associated with headers


9.3 Color Contrast
Text:

Normal text: Minimum 4.5:1 contrast ratio
Large text (18pt+): Minimum 3:1 contrast ratio

Interactive Elements:

Buttons, links: Sufficient contrast in all states (default, hover, focus, active)

Status Indicators:

Do NOT rely on color alone (use icons + text)
Example: "Completed" badge = green + checkmark icon


9.4 Focus Management
Modal Open:

Focus moves to first focusable element in modal
Previous focus saved

Modal Close:

Focus returns to element that opened modal (e.g., "Call" button)

Dynamic Content:

When content updates (e.g., search results), announce via ARIA live region
Focus management for dynamically added elements


10. TESTING REQUIREMENTS
10.1 Unit Testing
Component Tests:

Test each component in isolation
Mock API calls and dependencies
Test all user interactions (clicks, form submissions, etc.)
Target: 80% code coverage

Key Test Cases:
PhoneNumberInput Component:

Accepts various input formats
Normalizes to E.164
Displays formatted for readability
Validates correctly
Shows appropriate error messages

CallRecordingPlayer Component:

Loads recording URL
Plays/pauses correctly
Speed controls work
Download button triggers download
Error states display correctly

IvrMenuBuilder Component:

Adds/removes menu options
Validates unique digits
Saves configuration correctly
Drag-and-drop reordering (desktop)


10.2 Integration Testing
Form Submission Flows:

Twilio configuration: Submit form → API call → Success message
IVR configuration: Save menu → API call → Reload data
Send SMS: Submit form → API call → Update history

Permission-Based Rendering:

User without permission: Call button not visible
User with permission: Call button visible and functional

State Synchronization:

After sending SMS: History view updates to show new SMS
After adding whitelist number: Table refreshes with new entry


10.3 End-to-End Testing
Full User Flows:
Flow 1: First-Time Twilio Setup (Model A)

Navigate to /settings/communication/twilio
See setup wizard
Select "Use My Own Account"
Enter credentials
Click "Test Connection"
See success message
Click "Save Configuration"
See confirmation
Navigate away and back: Configuration persists

Flow 2: Make Outbound Call

Navigate to Lead detail page
Click "Call" button
Modal opens
Enter user phone number
Enter call reason
Click "Start Call"
See loading states
See success message
Navigate to Communication tab: Call appears in history

Flow 3: View Recording and Transcription

Navigate to Communication History
Find completed call with recording
Click row to open detail modal
Click "Play Recording"
Recording plays with controls
Click "View Transcription"
Transcription loads and displays
Search within transcription
Download transcription


10.4 Cross-Browser Testing
Supported Browsers:

Chrome (latest 2 versions)
Firefox (latest 2 versions)
Safari (latest 2 versions)
Edge (latest 2 versions)

Test:

All core functionality
Audio playback (recording player)
File downloads
Modal behavior
Form inputs


10.5 Responsive Testing
Test on:

Mobile devices (iOS Safari, Android Chrome)
Tablets (iPad, Android tablets)
Desktop (various screen sizes)

Test:

Layout does not break at any viewport size
Touch targets are large enough on mobile (minimum 44x44px)
Modals and forms are usable on small screens
Tables adapt to card layout on mobile


10.6 Accessibility Testing
Automated Tools:

Run axe DevTools or WAVE on all pages
Fix all critical and serious issues

Manual Testing:

Navigate entire app using only keyboard
Use screen reader (NVDA, JAWS, or VoiceOver) to test all features
Test color contrast with contrast checker tool


11. DEVELOPMENT TASK BREAKDOWN
Note: This is a high-level breakdown aligned with backend sprints. Detailed tasks will be created during sprint planning.
Phase 1: Foundation & Setup (Sprint 1)
Setup:

Create Communication module folder structure
Set up routing for all communication pages
Configure API client for communication endpoints
Set up state management (React Query/SWR)

Shared Components:

PhoneNumberInput component (with E.164 normalization, country selector)
E164Display component (format phone numbers for display)
CallStatusBadge component (status badges with colors/icons)

Testing:

Unit tests for shared components
Storybook stories for shared components (optional)


Phase 2: Twilio Configuration UI (Sprint 2)
Pages:

Twilio configuration page (route: /settings/communication/twilio)
Setup wizard for first-time configuration
Model selection cards
Configuration form (Model A)
Managed service request (Model B)

API Integration:

POST /api/communication/twilio/configure
GET /api/communication/twilio/configuration
DELETE /api/communication/twilio/configuration

Testing:

Unit tests for configuration components
Integration tests for API calls
E2E test for first-time setup flow


Phase 3: SMS Functionality (Sprint 3)
Components:

SendSmsModal component
SMS history view (embedded in history table)

Lead Detail Enhancements:

Add SMS button to Lead detail page
Communication tab with SMS history

API Integration:

POST /api/communication/sms/send
GET /api/communication/history (SMS filtering)

Testing:

Unit tests for SMS components
E2E test for send SMS flow
Test permission-based rendering


Phase 4: Call Functionality (Sprint 4)
Components:

InitiateCallModal component
Call history view (embedded in history table)

Lead Detail Enhancements:

Add Call button to Lead detail page
Enhanced Communication tab with call history

API Integration:

POST /api/communication/call/initiate
GET /api/communication/history (call filtering)

Testing:

Unit tests for call components
E2E test for initiate call flow
Test loading states and error handling


Phase 5: IVR Configuration UI (Sprint 5)
Pages:

IVR configuration page (route: /settings/communication/ivr)
IVR menu builder with drag-and-drop (desktop)
IVR action editor

Components:

IvrConfigurationForm component
IvrMenuBuilder component (drag-and-drop list)
IvrActionEditor component (conditional fields based on action type)

API Integration:

POST /api/communication/ivr/configure
GET /api/communication/ivr/configuration

Testing:

Unit tests for IVR components
Test drag-and-drop functionality
E2E test for IVR configuration flow


Phase 6: Office Whitelist UI (Sprint 6)
Pages:

Office whitelist page (route: /settings/communication/whitelist)

Components:

WhitelistManager component
WhitelistTable component
AddNumberModal component
EditNumberModal component

API Integration:

POST /api/communication/office-whitelist
GET /api/communication/office-whitelist
DELETE /api/communication/office-whitelist/:id

Testing:

Unit tests for whitelist components
E2E test for add/edit/delete whitelist entries


Phase 7: Recording & Transcription UI (Sprint 7)
Components:

CallRecordingPlayer component (with speed controls, download)
CallTranscriptionViewer component (with search)

API Integration:

GET /api/communication/call/:id/recording
GET /api/communication/call/:id/recording/download
GET /api/communication/call/:id/transcription

Enhancements:

Add recording player to history detail modal
Add transcription viewer to history detail modal
Polling mechanism for transcription status

Testing:

Unit tests for player and viewer components
Test audio playback functionality
Test transcription search
E2E test for viewing recording and transcription


Phase 8: Communication History UI (Sprint 8)
Pages:

Communication history page (route: /communication/history)

Components:

CommunicationHistoryView component
HistoryFilters component (sidebar or top bar)
HistoryTable component (with sorting, pagination)
HistoryDetailModal component

API Integration:

GET /api/communication/history (with filters, pagination)
GET /api/communication/transcriptions/search

Testing:

Unit tests for history components
Test filtering and pagination
Test transcription search functionality
E2E test for viewing history and details


Phase 9: Admin UI (Sprint 9)
Pages:

Admin usage dashboard (route: /admin/communication/usage)
Admin failed transcriptions (route: /admin/communication/transcriptions/failed)

Components:

UsageDashboard component (summary cards, charts, table)
FailedTranscriptionsTable component

API Integration:

GET /api/admin/communication/twilio/usage
GET /api/admin/communication/transcriptions/failed

Testing:

Unit tests for admin components
Test System Admin access control
E2E test for admin flows


Phase 10: Responsive & Accessibility (Sprint 10)
Responsive Enhancements:

Optimize all components for mobile (< 640px)
Test and fix tablet layouts (640px - 1024px)
Ensure desktop layouts are polished (> 1024px)

Accessibility:

Add ARIA labels to all icon-only buttons
Implement keyboard navigation for all interactive elements
Add focus traps to modals
Test with screen reader
Fix color contrast issues

Testing:

Responsive testing on real devices
Accessibility testing with automated tools and manual testing
Cross-browser testing


Phase 11: Polish & Performance (Sprint 11)
Polish:

Loading state refinements (skeletons, spinners)
Error message improvements
Success/info toast styling
Animation and transition polish

Performance:

Optimize component re-renders
Lazy load heavy components (recording player, etc.)
Code splitting for routes
Image/icon optimization

Testing:

Performance testing (Lighthouse, Web Vitals)
Final E2E regression testing
User acceptance testing


12. OPEN QUESTIONS FOR FRONTEND TEAM
None at this time. All requirements clarified.

13. DESIGN ASSETS NEEDED
13.1 Icons
Required Icons:

Phone (call icon) - inbound and outbound variants
Message bubble (SMS icon) - inbound and outbound variants
Play/Pause buttons
Download icon
Edit icon
Delete/trash icon
Settings/gear icon
Search/magnifying glass icon
Filter icon
Calendar icon (for date picker)
Checkmark (success)
Warning triangle (error)
Info circle (info)
External link icon

Icon Library:

Use existing Lead360 icon library (e.g., Lucide, Heroicons)
Ensure consistent style across all communication features


13.2 Illustrations
Empty States:

No Twilio configuration: Illustration of phone + settings
No communication history: Illustration of phone + message bubbles
No whitelist numbers: Illustration of phone + shield
No IVR menu: Illustration of phone + menu options

Success States:

Twilio configured: Checkmark with phone icon
Call connected: Two phones connected illustration
SMS sent: Message sent illustration


13.3 Brand Colors
Status Colors:

Success: Green (#10B981 or similar)
Error: Red (#EF4444 or similar)
Warning: Yellow (#F59E0B or similar)
Info: Blue (#3B82F6 or similar)

Direction Indicators:

Inbound: Blue accent
Outbound: Green accent

Call/SMS Type:

Call: Phone icon with specific color
SMS: Message icon with specific color


14. DEPLOYMENT CHECKLIST
Pre-Deployment:

 All components tested and reviewed
 API integration tested with backend staging environment
 Responsive design tested on all breakpoints
 Accessibility testing completed (automated + manual)
 Cross-browser testing completed
 Performance testing completed (Lighthouse score > 90)
 All error states tested and handled gracefully
 Loading states polished and consistent

Deployment:

 Deploy frontend to staging environment
 Smoke test all core flows in staging
 Test API integration with backend staging
 Conduct UAT (User Acceptance Testing) with stakeholders
 Fix any critical bugs found in staging
 Deploy to production
 Monitor for errors in production

Post-Deployment:

 Verify all pages load correctly in production
 Test SMS send flow in production
 Test call initiation flow in production
 Monitor API error rates
 Collect user feedback
 Address any usability issues