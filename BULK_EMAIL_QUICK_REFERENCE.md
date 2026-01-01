# Bulk Email Feature - Quick Reference

## What's Been Added

### 📧 New Files
1. **`app/api/send-bulk-email/route.ts`** - API endpoint for sending emails
2. **`components/bulk-email-dialog.tsx`** - Email composition UI dialog
3. **`supabase/migrations/20251230_add_email_campaigns.sql`** - Database schema

### 🔧 Modified Files
1. **`app/dashboard/leads/page.tsx`** - Added bulk email button and integration

## How It Works

### User Flow
```
1. Select leads (checkboxes)
   ↓
2. Click "Send Email" button (appears when leads selected)
   ↓
3. Fill in sender name, subject, message
   ↓
4. Use {variable} buttons or type variables manually
   ↓
5. Click "Send N Email(s)"
   ↓
6. API processes batch and sends emails
   ↓
7. Results logged to database
   ↓
8. Success dialog shows sent/failed counts
```

### Technical Flow
```
User UI (bulk-email-dialog.tsx)
    ↓
POST /api/send-bulk-email
    ↓
Template variable replacement
    ↓
Email service API (Resend/SendGrid/Nodemailer)
    ↓
Create email_campaigns record
    ↓
Create email_logs entries (one per recipient)
    ↓
Return success/failure counts
```

## Installation Checklist

- [ ] Install email service: `npm install resend`
- [ ] Add `RESEND_API_KEY` to `.env.local`
- [ ] Run database migration (SQL in setup guide)
- [ ] Test with 1-2 leads first
- [ ] Scale up to larger batches

## Quick Test

1. Go to Leads page
2. Select 1 lead
3. Click "Send Email (1)" button
4. Enter test message: "Hi {firstName}, test email"
5. Click send
6. Check success message

## Template Variables Available

```
{name}        → "John Smith"
{firstName}   → "John"
{lastName}    → "Smith"
{company}     → "Acme Corp"
{title}       → "Sales Manager"
{email}       → "john@acme.com"
{phone}       → "+1-555-0123"
```

## Files Structure

```
LeadVault/
├── app/
│   ├── api/
│   │   ├── imports/
│   │   ├── fetch-sheet/
│   │   └── send-bulk-email/          ← NEW
│   │       └── route.ts
│   └── dashboard/
│       └── leads/
│           └── page.tsx              ← MODIFIED
├── components/
│   ├── bulk-email-dialog.tsx         ← NEW
│   ├── dashboard-layout.tsx
│   └── ui/
├── supabase/
│   └── migrations/
│       ├── 20251216233609_create_leads_schema.sql
│       ├── 20251217_add_account_sharing.sql
│       └── 20251230_add_email_campaigns.sql  ← NEW
├── BULK_EMAIL_SETUP.md               ← NEW (detailed guide)
└── lib/
```

## Configuration

### Email Service Selection

**Recommended: Resend** (best for startups)
- Sign up: https://resend.com
- Free tier: 100 emails/day
- Setup: `npm install resend` + add API key

**Alternative: SendGrid**
- Sign up: https://sendgrid.com
- Free tier: 100 emails/day
- Update: Use SendGrid client in API route

**Alternative: Nodemailer** (self-hosted)
- Setup: Use SMTP credentials
- No API key needed, direct SMTP connection

## Customization Examples

### Add custom variable
In `app/api/send-bulk-email/route.ts`, update fieldMappings:
```typescript
const fieldMappings = {
  // ... existing
  website: ['website'],
  location: ['location'],
};
```

### Change email format
In same file, modify HTML template:
```typescript
html: `<html><body>${personalizedMessage}</body></html>`,
```

### Add attachments (Resend)
```typescript
await service.emails.send({
  from: `${senderName} <${senderEmail}>`,
  to: lead.email,
  subject,
  html: personalizedMessage,
  attachments: [{
    filename: 'proposal.pdf',
    content: fs.readFileSync('path/to/file'),
  }],
});
```

## Database Queries (for debugging)

### View campaigns
```sql
SELECT * FROM email_campaigns WHERE user_id = 'user-uuid';
```

### View email logs
```sql
SELECT * FROM email_logs 
WHERE campaign_id = 'campaign-uuid'
ORDER BY created_at DESC;
```

### View failed emails
```sql
SELECT * FROM email_logs 
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Campaign statistics
```sql
SELECT 
  ec.id,
  ec.name,
  ec.sent_count,
  ec.failed_count,
  ec.status,
  COUNT(el.id) as total_logs
FROM email_campaigns ec
LEFT JOIN email_logs el ON ec.id = el.campaign_id
GROUP BY ec.id;
```

## Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| "No leads provided" | Select at least 1 lead before sending |
| "Subject and message required" | Fill in both fields |
| API 500 error | Check `.env.local` has `RESEND_API_KEY` |
| "Failed to send" | Verify email addresses are valid |
| Emails not arriving | Check email service dashboard for bounces |
| Rate limit error | Reduce batch size or upgrade email service |
| Missing {variable} | Ensure lead has that field filled in |

## Performance Tips

1. **Small batches first**: Test with 1-5 leads
2. **Check send status**: Monitor email_logs table
3. **Validate emails**: Ensure all leads have valid emails
4. **Monitor quota**: Check email service usage
5. **Schedule large campaigns**: Send during off-peak hours
6. **Add delays**: Implement 1s delay between batches for 1000+ leads

## Next: Advanced Features (Optional)

- [ ] Add email scheduling
- [ ] Implement email templates library
- [ ] Add A/B testing variants
- [ ] Integrate email open/click tracking
- [ ] Add unsubscribe list management
- [ ] Bulk email validation before sending
