# Multi-Level IVR Menu — User Guide

**Last Updated**: February 2026
**For**: Business Owners & Administrators
**Platform**: Lead360 Communication System

---

## What is Multi-Level IVR?

**Multi-Level IVR** (Interactive Voice Response) allows you to create sophisticated phone menus with multiple layers, similar to what you experience when calling large companies.

### Simple Example

Instead of a flat menu like:
- Press 1 for Sales
- Press 2 for Support
- Press 3 for Billing

You can create nested menus:
- Press 1 for Sales
  - Press 1 for New Customers
  - Press 2 for Existing Customers
    - Press 1 for Account Questions
    - Press 2 for Technical Support

This helps callers find exactly what they need without overwhelming them with too many choices at once.

---

## Why Use Multi-Level IVR?

### Benefits

✅ **Better Caller Experience**
Break complex options into digestible chunks (5-7 choices per level is optimal)

✅ **More Efficient Routing**
Direct callers to the right person or department faster

✅ **Professional Image**
Gives your business a polished, enterprise-level feel

✅ **Scalability**
Easily add new departments or services without cluttering the main menu

✅ **Integration with AI Assistant**
Route specific calls to your AI voice assistant for automated handling

### When to Use It

Use multi-level IVR if your business has:
- Multiple departments (Sales, Support, Billing)
- Different service types (Residential vs Commercial)
- Specialized teams (New customers vs Existing customers)
- Regional offices or locations
- Emergency vs non-emergency services

---

## How to Set Up Multi-Level IVR

### Step 1: Access IVR Configuration

1. Log in to your Lead360 dashboard
2. Navigate to **Communications** → **Twilio** → **IVR Settings**
3. Click **Edit IVR Configuration** (or **Create IVR** if this is your first time)

### Step 2: Create Your Main Menu

1. **Enable IVR**: Toggle the switch to ON
2. **Greeting Message**: Write what callers will hear first
   Example: *"Thank you for calling ABC Plumbing. Please listen to the following options."*
3. **Add Menu Options**: Click **+ Add Option** to create choices (Press 1, Press 2, etc.)

### Step 3: Add a Submenu

For any menu option, you can choose **"Navigate to Submenu"** as the action:

1. Select an option (e.g., "Press 1 for Sales")
2. Change **Action** dropdown to **"Submenu"**
3. Click **Add Submenu Options**
4. Fill in:
   - **Submenu Greeting**: What callers hear at this level
     Example: *"Sales Department. Press 1 for new customers or 2 for existing customers."*
   - **Submenu Options**: The choices available at this level

### Step 4: Go Deeper (Optional)

You can nest submenus up to **5 levels deep**, but we recommend staying at **2-3 levels** for best user experience.

Each submenu can have:
- Its own greeting message
- Up to 10 options (digits 0-9)
- Terminal actions (call routing, voicemail) OR another submenu

### Step 5: Configure Settings

**Timeout**: How long to wait for input (5-60 seconds, default: 10)
**Max Retries**: How many times to re-prompt on invalid input (1-5, default: 3)
**Max Depth**: Maximum menu levels allowed (1-5, default: 4)
**Default Action**: What happens if caller doesn't press anything (usually voicemail)

### Step 6: Save & Test

1. Click **Save Configuration**
2. **Test immediately** by calling your business number
3. Listen for errors or confusing wording
4. Adjust and save again if needed

---

## Menu Structure Best Practices

### Keep It Simple

❌ **DON'T**:
```
Main Menu: 9 options
  → Sales: 8 options
    → New Customers: 6 options
```

✅ **DO**:
```
Main Menu: 4 options
  → Sales: 3 options
    → New Customers: 2-3 options
```

### Design Rules of Thumb

| Guideline | Reason |
|-----------|--------|
| **Max 7 options per level** | Humans struggle to remember more than 7 items |
| **Max 3 levels deep** | Callers get frustrated navigating deeper than this |
| **Keep greetings under 20 seconds** | Long messages lead to hang-ups |
| **Group related items** | Put similar services together |
| **Most popular option first** | 80% of calls go to 20% of options - optimize for this |

### Example Structure (Plumbing Company)

```
Main Menu:
├─ 1. Emergency Service → Route to on-call technician
├─ 2. Schedule Appointment
│  ├─ 1. Residential → AI Assistant or Sales
│  └─ 2. Commercial → Sales Manager
├─ 3. Existing Customers
│  ├─ 1. Check Appointment Status → AI Assistant
│  ├─ 2. Billing Questions → Billing Department
│  └─ 3. Request Callback → Voicemail
└─ 4. General Information → AI Assistant or Voicemail
```

---

## Available Actions

At any menu level, you can configure these actions:

| Action | What It Does | When to Use |
|--------|--------------|-------------|
| **Route to Number** | Forward call to specific phone number | Direct lines to departments/people |
| **AI Voice Assistant** | Connect to your Lead360 AI assistant | Handle common questions, book appointments, capture leads |
| **Voicemail** | Record message (up to 5 minutes) | After-hours or when no one available |
| **Submenu** | Navigate to another menu level | When caller needs more specific options |
| **Return to Parent Menu** | Go back one level | Let caller backtrack if they made a mistake |
| **Return to Main Menu** | Jump back to the root menu | Quick escape from deep menus |
| **Webhook** | Trigger external system | Advanced integrations (requires technical setup) |

---

## Navigation Options

### Going Back

Callers sometimes press the wrong digit. Give them escape options:

- **"Press 0 to return to the main menu"** (use Return to Main Menu action)
- **"Press 9 to go back"** (use Return to Parent Menu action)
- **"Press * to repeat options"** (redirect to same menu)

Example:
```
Sales Submenu:
├─ 1. New Customers → AI Assistant
├─ 2. Existing Customers → Sales Rep
├─ 0. Return to Main Menu
└─ 9. Repeat options (redirect to this menu)
```

---

## Troubleshooting

### Problem: Callers report menu is confusing

**Solutions**:
- Simplify: Reduce options from 7+ to 4-5
- Shorten greetings: Cut greeting messages in half
- Reorder: Put most popular choice first
- Test yourself: Call your number and experience it as a customer

### Problem: Validation error "Menu depth exceeds maximum"

**Cause**: You're trying to create more than 5 levels of submenus

**Solution**: Flatten your structure or increase max_depth setting (not recommended beyond 5)

### Problem: Error "Duplicate digits found"

**Cause**: Two options at the same menu level use the same digit

**Solution**: Each digit (0-9) can only be used once per level. Change one of the duplicate digits.

### Problem: Error "Circular reference detected"

**Cause**: Your menu structure loops back on itself (Submenu A leads to Submenu B which leads back to Submenu A)

**Solution**: Remove the loop. Menus should always flow forward or allow navigation back via Return actions.

### Problem: Error "Total menu options exceeds maximum of 100"

**Cause**: Your entire menu tree has more than 100 total options across all levels

**Solution**: Simplify your menu structure. Most businesses only need 10-30 total options.

### Problem: Callers hang up before finishing menu

**Causes**:
- Greeting too long (>30 seconds)
- Too many options (>7 per level)
- Too many levels (>3 deep)
- Confusing wording

**Solutions**:
- Test on mobile phone yourself
- Ask employees to test and give feedback
- Monitor call analytics for high abandon rates
- Consider using AI Assistant instead of deep menus

---

## Tips for Writing Effective Greetings

### Main Greeting

✅ **GOOD**:
> "Thank you for calling ABC Plumbing. For emergency service, press 1. To schedule an appointment, press 2. For existing customers, press 3."

❌ **TOO LONG**:
> "Thank you for calling ABC Plumbing, South Florida's premier plumbing service provider since 1995, serving Miami-Dade, Broward, and Palm Beach counties with residential and commercial plumbing solutions. We're here to help you with all your plumbing needs. Our business hours are Monday through Friday, 8am to 6pm, and Saturday 9am to 2pm. We offer..."

### Submenu Greetings

✅ **GOOD**:
> "Sales Department. Press 1 for new customers or 2 for existing customers."

❌ **TOO WORDY**:
> "You've reached the sales department where our friendly and knowledgeable sales representatives are standing by to assist you with..."

### Key Principles

1. **Get to options quickly** (within 5 seconds if possible)
2. **Use active voice** ("Press 1 for..." not "If you'd like to...")
3. **Be specific** ("Press 1 for emergency service" not "Press 1 for help")
4. **Skip obvious statements** (Don't say "Please listen carefully as our menu options have changed")

---

## FAQ

### Q: How many levels can I create?

**A**: Technically up to 5, but we recommend staying at 2-3 levels maximum for better caller experience.

### Q: Can I have more than 10 options at one level?

**A**: No. Each menu level is limited to 10 options (digits 0-9). If you need more, break them into submenus.

### Q: What's the difference between "Route to Number" and "AI Voice Assistant"?

**A**:
- **Route to Number**: Directly forwards the call to a phone number (person, department, external line)
- **AI Voice Assistant**: Connects to Lead360's AI that can answer questions, book appointments, and create leads automatically

### Q: Can I route to the same phone number from multiple menu options?

**A**: Yes! You can route "Press 1 for Sales" and "Press 2 for New Customers" to the same number if needed.

### Q: What happens if I don't set up a default action?

**A**: You must set a default action. This determines what happens if a caller doesn't press anything or presses an invalid digit.

### Q: Can I change the voice that speaks the greetings?

**A**: Yes, in Advanced Settings you can select different voices (male/female, different accents). The default is Polly.Joanna (female US English).

### Q: Will my current callers notice if I change the menu?

**A**: Yes, changes take effect immediately. Consider:
- Announce menu changes on your website/social media
- Keep the most common options in the same spot (e.g., if "Press 1 for Sales" was popular, keep it as Press 1)
- Test thoroughly before saving

### Q: Can I schedule different menus for different times?

**A**: Not directly in IVR settings, but you can:
- Use "Return to Default" action that routes to your main number (which may have different after-hours handling)
- Set up multiple phone numbers with different IVR configs
- Contact support for advanced time-based routing

### Q: How do I disable IVR temporarily?

**A**:
1. Go to **Communications** → **Twilio** → **IVR Settings**
2. Toggle **IVR Enabled** to OFF
3. Click **Save**

Calls will ring directly to your main number without going through the menu.

### Q: Can callers press digits while the greeting is playing?

**A**: Yes! This is called "interrupt" mode and it's enabled by default. Callers don't have to wait for the full greeting.

### Q: What if a caller presses an invalid digit?

**A**: The system will say "Invalid option. Please try again." and replay the menu. After 3 failed attempts (configurable), it executes the default action (usually voicemail).

### Q: Can I see which menu options are most popular?

**A**: Yes! Go to **Communications** → **Call Analytics** to see which IVR paths callers take most frequently. Use this data to optimize your menu structure.

---

## Examples by Industry

### Home Services (Plumbing, HVAC, Electrical)

```
Main Menu:
├─ 1. Emergency Service → On-call Technician
├─ 2. Schedule Appointment → AI Assistant
├─ 3. Check Appointment → AI Assistant
└─ 0. Billing/Other → Office Staff
```

### Medical/Dental Office

```
Main Menu:
├─ 1. New Patients → Receptionist
├─ 2. Existing Patients
│  ├─ 1. Schedule Appointment → AI Assistant
│  ├─ 2. Prescription Refills → Nurse Line
│  └─ 3. Billing → Billing Department
└─ 3. Emergencies → On-call Doctor
```

### Real Estate Agency

```
Main Menu:
├─ 1. Buying a Home → Buyer's Agent
├─ 2. Selling Your Home → Listing Agent
├─ 3. Property Management → PM Department
└─ 4. Current Clients → AI Assistant
```

### Law Firm

```
Main Menu:
├─ 1. New Clients
│  ├─ 1. Personal Injury → PI Attorney
│  ├─ 2. Family Law → Family Attorney
│  └─ 3. Business Law → Business Attorney
├─ 2. Existing Clients → Receptionist
└─ 3. General Information → Voicemail
```

---

## Getting Help

If you need assistance setting up your multi-level IVR:

1. **Watch Tutorial Video**: Available in the IVR Settings page (click "Watch Tutorial")
2. **Live Chat Support**: Click the chat icon in bottom-right corner
3. **Email Support**: support@lead360.app
4. **Schedule Onboarding Call**: Contact your account manager

Our support team can help you:
- Design the optimal menu structure for your business
- Test your configuration before going live
- Analyze call data to optimize performance
- Integrate with your AI Assistant

---

## Summary Checklist

Before going live with your multi-level IVR, verify:

- [ ] Main greeting is clear and under 20 seconds
- [ ] Each menu level has 7 or fewer options
- [ ] Menu depth is 3 levels or less
- [ ] Most popular option is Press 1
- [ ] Emergency/urgent options are easy to find
- [ ] Every path leads to a resolution (no dead ends)
- [ ] Timeout settings are appropriate (10-15 seconds)
- [ ] Default action is configured
- [ ] You've tested the full flow by calling your number
- [ ] At least 2 other people have tested and given feedback
- [ ] Navigation options (return to main menu, go back) are available

---

**Ready to get started?** Log in to your Lead360 dashboard and navigate to **Communications** → **Twilio** → **IVR Settings**!
