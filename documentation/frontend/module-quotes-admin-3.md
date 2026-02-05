# Admin Frontend Dev 3: Template Builder/Visual Editor ⭐

**Developer**: Frontend Developer 3  
**Duration**: 10 days (most complex component)  
**Prerequisites**: Read `ADMIN_FRONTEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build the visual template builder - the crown jewel of the admin system:
- Drag-and-drop template editor
- Component library
- Visual canvas
- Properties editor
- Live preview
- Template variable system

**This is the MOST IMPORTANT admin feature. Take time to build it right.**

---

## OVERALL LAYOUT

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Builder: [Template Name]                    [Save] [X] │
├───────────┬─────────────────────────────┬───────────────────────┤
│           │                             │                       │
│ Component │         Canvas              │  Properties Panel     │
│ Library   │         (Preview)           │                       │
│           │                             │  [Component Settings] │
│ 250px     │         600-800px           │       300px           │
│           │                             │                       │
│ Sections  │                             │  When component       │
│ ▼ Header  │   ┌─────────────────┐      │  selected, show:      │
│ ▼ Body    │   │  Drop zone      │      │  - Content editor     │
│ ▼ Footer  │   └─────────────────┘      │  - Style controls     │
│           │                             │  - Layout options     │
│ Elements  │   Components render here    │                       │
│ □ Text    │   with handles for:         │                       │
│ □ Image   │   - Resize                  │  Variable inserter    │
│ □ Table   │   - Move                    │  shown when editing   │
│ □ QR Code │   - Delete                  │  text fields          │
│           │                             │                       │
├───────────┴─────────────────────────────┴───────────────────────┤
│ [Device: Desktop ▼] [Preview] [Test PDF] [Undo] [Redo]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. COMPONENT LIBRARY (LEFT SIDEBAR)

### Pre-built Sections
Drag entire pre-configured sections to canvas:

**Header Section**:
- Company logo (variable: `{{company.logo}}`)
- Company name and contact
- Quote number and date

**Customer Section**:
- Customer name, email, phone
- Billing address
- Shipping address (if different)

**Items Table Section**:
- Configurable columns
- Row template with variables
- Subtotal row

**Totals Section**:
- Subtotal, Tax, Discount, Total
- Formatted with currency

**Terms Section**:
- Editable terms and conditions
- Signature line

**Footer Section**:
- Company tagline
- Legal text
- Contact information

### Basic Elements
Individual building blocks:

**Text Block**:
- Rich text editor (bold, italic, alignment)
- Variable insertion
- Font and color controls

**Image Block**:
- Upload image OR
- Use URL
- Size and alignment controls

**Table Block**:
- Custom rows and columns
- Cell formatting
- Border controls

**Spacer**:
- Adjustable height
- Invisible spacing element

**Divider Line**:
- Horizontal rule
- Style and color options

**QR Code Block**:
- Variable-driven (e.g., `{{quote.public_url}}`)
- Size controls

---

## 2. CANVAS (CENTER)

### Drag-and-Drop Implementation

**Libraries to Use**:
- `react-dnd` OR `dnd-kit` (recommended: dnd-kit)
- Draggable components from library
- Droppable zones on canvas

**Drop Zones**:
- Show visual indicator when dragging
- Highlight valid drop targets
- Insert component at drop location
- Maintain component order

### Component Rendering

Each component on canvas shows:
- **Content Preview**: How it will look
- **Selection Border**: When selected (blue outline)
- **Drag Handle**: Icon to drag/reorder
- **Resize Handles**: Corners for resizing (if applicable)
- **Delete Button**: X button on hover

### Canvas Actions

**Selection**:
- Click component to select
- Selected component highlights
- Properties panel updates

**Reordering**:
- Drag component by handle
- Visual feedback during drag
- Smooth animations

**Deletion**:
- Click X button
- Confirm for sections (undo available)

**Undo/Redo**:
- Track canvas state history
- Undo button (Cmd/Ctrl + Z)
- Redo button (Cmd/Ctrl + Shift + Z)

---

## 3. PROPERTIES PANEL (RIGHT SIDEBAR)

### Component-Specific Properties

**When Text Block Selected**:
- **Content Tab**:
  - Rich text editor (TinyMCE or Quill)
  - Variable inserter button
  - Character count
- **Style Tab**:
  - Font family (dropdown)
  - Font size (slider or input)
  - Font color (color picker)
  - Text alignment (left, center, right, justify)
  - Line height
- **Layout Tab**:
  - Width (%, px, auto)
  - Padding (top, right, bottom, left)
  - Margin
  - Background color

**When Image Block Selected**:
- **Content Tab**:
  - Upload image button
  - Image URL input
  - Alt text
- **Style Tab**:
  - Border (width, color, radius)
  - Shadow
- **Layout Tab**:
  - Width, height
  - Alignment
  - Padding

**When Table Block Selected**:
- **Content Tab**:
  - Add/remove rows
  - Add/remove columns
  - Cell content editors
- **Style Tab**:
  - Header style
  - Row stripe colors
  - Border style
- **Layout Tab**:
  - Column widths
  - Cell padding

**When Items Table (Section) Selected**:
- **Content Tab**:
  - Toggle columns (Item, Qty, Unit Price, Total, etc.)
  - Show/hide group headers
  - Show/hide subtotals
- **Style Tab**:
  - Table theme (professional, modern, minimal)
  - Header colors
  - Row colors
- **Variables**:
  - `{{items}}` loop
  - `{{item.title}}`, `{{item.quantity}}`, etc.

---

## 4. VARIABLE SYSTEM

### Variable Inserter

**Trigger**: "Insert Variable" button in text editor

**Modal**:
```
┌─────────────────────────────┐
│ Insert Variable             │
├─────────────────────────────┤
│ Search: [_____________]     │
│                             │
│ Categories:                 │
│ ▼ Company                   │
│   {{company.name}}          │
│   {{company.logo}}          │
│   {{company.address}}       │
│                             │
│ ▼ Quote                     │
│   {{quote.number}}          │
│   {{quote.title}}           │
│   {{quote.date}}            │
│                             │
│ ▼ Customer                  │
│   {{customer.name}}         │
│   {{customer.email}}        │
│                             │
│ ▼ Items (Loop)              │
│   {{#each items}}           │
│   {{item.title}}            │
│   {{item.quantity}}         │
│   {{/each}}                 │
│                             │
│ [Insert] [Cancel]           │
└─────────────────────────────┘
```

**Functionality**:
- Search filters variables
- Click to select
- Insert at cursor position
- Syntax highlighting in editor

### Available Variables

Read from API: `GET /admin/quotes/templates/variables`

**Variable Categories**:
- Company: name, logo, address, phone, email, website
- Quote: number, title, date, expiration_date, status
- Customer: name, email, phone, company, address fields
- Vendor: name, email, phone, signature
- Items: Loop with title, description, quantity, unit, price, total
- Groups: Loop with group name, items
- Totals: subtotal, tax, discount, total
- Jobsite: address fields

**Conditional Variables**:
```handlebars
{{#if has_discount}}
  Discount: {{discount_amount}}
{{/if}}
```

---

## 5. PREVIEW MODES

### Device Preview Selector

**Options**:
- Desktop (default, 8.5" x 11" PDF)
- Tablet (768px)
- Mobile (375px)

**Implementation**:
- Canvas width changes
- Components reflow (responsive)
- Preview how template looks on different devices

### Live Preview

**Toggle**: "Live Preview" button

**When Enabled**:
- Fetches sample quote data
- Renders template with real data
- Variables replaced with actual values
- Updates as you edit

**Sample Data Source**:
- API: `POST /admin/quotes/templates/:id/preview` (minimal/standard/complex)

### PDF Preview

**Button**: "Test PDF"

**Functionality**:
- Calls: `POST /admin/quotes/templates/:id/test-pdf`
- Generates PDF
- Opens in new tab or modal
- Shows warnings if any

---

## 6. SAVE & AUTO-SAVE

### Save Button

**Action**:
- Validates template
- Calls: `PATCH /admin/quotes/templates/:id`
- Saves HTML content, CSS, and metadata
- Shows success toast

### Auto-Save

**Implementation**:
- Save draft every 30 seconds
- Show "Saving..." indicator
- Show "All changes saved" when complete
- Debounce on user edits

---

## 7. TEMPLATE VALIDATION

Before saving, validate:
- Required sections present (Header, Items, Totals)
- No syntax errors in variables
- All images have valid URLs or uploads
- HTML structure valid
- CSS compiles

**Validation Errors**:
- Show in modal or sidebar
- Highlight problem components
- Prevent save until fixed

---

## 8. TOOLBAR (BOTTOM)

**Actions**:
- Device selector dropdown
- Preview button (live preview toggle)
- Test PDF button
- Undo button
- Redo button
- Save button
- Help/documentation link

---

## TECHNICAL IMPLEMENTATION

### State Management

Use Zustand or Redux:
```typescript
interface BuilderState {
  components: Component[],
  selectedComponentId: string | null,
  history: Component[][],
  historyIndex: number,
  isDirty: boolean
}
```

### Component Data Structure

```typescript
interface Component {
  id: string,
  type: 'text' | 'image' | 'table' | 'section' | etc,
  properties: {
    content: any,
    style: CSSProperties,
    layout: LayoutProps
  },
  children?: Component[]
}
```

### Template Output

Generate Handlebars template:
```html
<!DOCTYPE html>
<html>
<head>
  <style>{generated CSS}</style>
</head>
<body>
  {rendered components with variables}
</body>
</html>
```

---

## TESTING REQUIREMENTS

### Functional Tests
- Drag component to canvas
- Edit component properties
- Insert variable
- Preview template
- Generate PDF
- Save template
- Undo/redo

### Edge Cases
- Empty canvas
- Invalid variables
- Large templates (100+ components)
- Slow network (save conflicts)

---

## DELIVERABLES

1. Template builder page (full layout)
2. Component library (sections + elements)
3. Drag-and-drop canvas
4. Properties panel (all component types)
5. Variable inserter modal
6. Preview modes (device, live, PDF)
7. Save/auto-save functionality
8. Undo/redo system
9. Validation engine
10. Tests

---

## COMPLETION CRITERIA

- Can build complete template from scratch
- All sections and elements work
- Drag-and-drop smooth
- Properties update correctly
- Variables insert and preview
- PDF generation works
- Save persists changes
- Undo/redo functional
- Performance acceptable (handles 50+ components)
- Tests pass

---

**This is the most complex feature. Budget time for iterations and refinements.**