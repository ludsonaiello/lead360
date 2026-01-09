# Background Jobs - Quick Access Guide

## 🎯 How to Access Background Jobs

### Via Navigation Menu

1. **Log in to Lead360** as a Platform Admin
2. **Open the sidebar** (click the menu icon on mobile, or it's always visible on desktop)
3. **Scroll to "Platform Admin" section** in the sidebar
4. **Click "Background Jobs"** (with gear/cog icon)

The menu item is located in the **Platform Admin** section, alongside:
- Roles
- Permissions
- Modules
- Templates
- **Background Jobs** ⚙️ ← NEW
- All Media
- System Audit Log

### Direct URLs

You can also access the pages directly:

**Main Dashboard:**
```
https://app.lead360.app/admin/jobs
```

**Failed Jobs:**
```
https://app.lead360.app/admin/jobs/failed
```

**Scheduled Jobs:**
```
https://app.lead360.app/admin/jobs/schedules
```

**Job History (requires schedule ID):**
```
https://app.lead360.app/admin/jobs/schedules/{schedule-id}/history
```

**SMTP Settings:**
```
https://app.lead360.app/admin/jobs/email-settings
```

**Email Templates:**
```
https://app.lead360.app/admin/jobs/email-templates
```

---

## 🔐 Permissions Required

**IMPORTANT**: Only **Platform Admins** can access these pages.

The menu item will only be visible to users with:
- `platform_admin:view_all_tenants` permission

If you don't see the "Background Jobs" menu item:
1. Check if you're logged in as a Platform Admin
2. Verify your user has platform admin permissions
3. Try refreshing the page

---

## 🎨 What You'll See

### Main Dashboard (`/admin/jobs`)
- **Queue Health Card** - Real-time metrics (auto-refreshes every 5 seconds)
- **Failed Jobs Alert** - Banner if there are failed jobs
- **Job Filters** - Filter by status, type, date range
- **Job List** - Paginated table/cards with all jobs
- **Job Details Modal** - Click any job to see full details

### Failed Jobs (`/admin/jobs/failed`)
- List of all failed jobs
- **Retry All** button - Retry all failed jobs at once
- **Clear Queue** button - Delete all failed jobs
- Individual retry buttons for each job

### Scheduled Jobs (`/admin/jobs/schedules`)
- Grid of scheduled job cards
- **Enable/Disable Toggle** - Turn jobs on/off
- **Edit** button - Modify cron schedule
- **Run Now** button - Trigger job manually
- **View History** button - See execution history

### SMTP Settings (`/admin/jobs/email-settings`)
- SMTP configuration form
- Gmail/Office 365 examples
- **Test Email** button - Send test email
- Verified status badge

### Email Templates (`/admin/jobs/email-templates`)
- List of all email templates
- **Search** - Filter templates
- **Create Template** button - Add new template
- **Edit** - Modify custom templates (system templates are read-only)
- **Preview** - See rendered template with sample data
- **Delete** - Remove custom templates

---

## 🚀 Quick Start Guide

### 1. First Time Setup

**Configure SMTP Settings:**
1. Go to `/admin/jobs/email-settings`
2. Enter your SMTP credentials
3. Click "Send Test Email"
4. Save settings

**Check Scheduled Jobs:**
1. Go to `/admin/jobs/schedules`
2. Review existing scheduled jobs
3. Enable/disable as needed
4. Edit schedules if required

### 2. Monitor Jobs

**Daily Monitoring:**
1. Go to `/admin/jobs`
2. Check Queue Health Card (should be "Healthy")
3. Look for failed jobs alert
4. Review recent jobs in the list

**Handle Failed Jobs:**
1. Go to `/admin/jobs/failed`
2. Click a job to see error details
3. Click "Retry" to requeue the job
4. Or use "Retry All" for bulk retry

### 3. Manage Templates

**Create Email Template:**
1. Go to `/admin/jobs/email-templates`
2. Click "Create Template"
3. Enter template key (e.g., "welcome-email")
4. Write subject and body with Handlebars variables
5. Add variables (e.g., "user_name", "company_name")
6. Click "Create Template"

**Preview Template:**
1. Find your template in the list
2. Click "Preview"
3. See rendered HTML with sample data

---

## 💡 Pro Tips

1. **Auto-Refresh**: The main dashboard auto-refreshes every 5 seconds - no need to manually refresh!

2. **Mobile Friendly**: All pages work perfectly on mobile. Tables convert to cards automatically.

3. **Dark Mode**: Full dark mode support - toggle in your system preferences.

4. **Cron Schedules**: Use the preset picker for common schedules, or enter custom cron expressions.

5. **System Templates**: Cannot be edited or deleted (they're protected). Only custom templates can be modified.

6. **Queue Health Colors**:
   - 🟢 **Green (Healthy)**: Everything is working fine
   - 🟡 **Yellow (Warning)**: Some failed jobs or high queue
   - 🔴 **Red (Unhealthy)**: Many failed jobs - needs attention

7. **Job Details**: Click any job in the list to see:
   - Full details (timestamps, attempts, priority)
   - Execution logs (color-coded by level)
   - Payload (input data)
   - Result (output data)

8. **Keyboard Navigation**: Use Tab/Enter to navigate forms and modals.

---

## 🆘 Troubleshooting

**Can't see "Background Jobs" in menu?**
- Verify you're logged in as Platform Admin
- Check permissions: `platform_admin:view_all_tenants`
- Refresh the page

**Queue Health shows "Unhealthy"?**
- Check failed jobs count
- Review error messages in failed jobs
- Check SMTP settings if email jobs are failing

**Test email not sending?**
- Verify SMTP settings are correct
- Check username/password
- For Gmail: Use app-specific password, not regular password
- Check port and encryption settings

**Scheduled job not running?**
- Check if job is enabled (toggle switch)
- Verify cron expression is valid
- Check next run time
- Review job history for errors

---

## 📞 Need Help?

Check these resources:
- **Completion Report**: `app/documentation/FRONTEND_COMPLETION_REPORT.md`
- **API Documentation**: `api/documentation/background_jobs_REST_API.md`
- **Contract**: `documentation/contracts/background_jobs-contract.md`

---

**Happy job monitoring!** 🎉
