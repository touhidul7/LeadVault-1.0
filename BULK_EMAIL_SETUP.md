# Bulk Email Send Feature - Setup Guide

## Overview
The bulk email feature allows you to send personalized emails to multiple leads at once. Messages support dynamic personalization using template variables like `{name}`, `{company}`, etc.

## Features
✅ Send personalized emails to multiple selected leads
✅ Dynamic name/company personalization using template variables
✅ Email delivery tracking and logging
✅ Success/failure reporting
✅ Campaign history stored in database

## Quick Start

### 1. **Install Email Service Package**

We recommend using **Resend** (free tier available, excellent for startups):

```bash
npm install resend
```

**Other options:**
- SendGrid: `npm install @sendgrid/mail`
- Nodemailer: `npm install nodemailer`

### 2. **Set Up Environment Variables**

Create a `.env.local` file in your project root and add your email service credentials:

#### For Resend:
```env
RESEND_API_KEY=re_your_api_key_here
```

#### For SendGrid:
```env
SENDGRID_API_KEY=SG.your_api_key_here
```

#### For Nodemailer (Gmail example):
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

### 3. **Run Database Migration**

Apply the email campaigns schema migration to your Supabase database:

```bash
# The migration file is already created at:
# supabase/migrations/20251230_add_email_campaigns.sql
```

In Supabase dashboard:
1. Go to SQL Editor
2. Paste the contents of the migration file
3. Click "RUN"

Or use Supabase CLI:
```bash
supabase db push
```

### 4. **Update API Route (Optional)**

The API route (`app/api/send-bulk-email/route.ts`) is pre-configured for Resend, but you can customize it for other services:

#### For SendGrid:
Replace the email sending logic in `app/api/send-bulk-email/route.ts`:
```typescript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const result = await sgMail.send({
  to: lead.email,
  from: senderEmail,
  subject,
  html: personalizedMessage.replace(/\n/g, '<br>'),
});
```

#### For Nodemailer:
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const result = await transporter.sendMail({
  to: lead.email,
  from: senderEmail,
  subject,
  html: personalizedMessage.replace(/\n/g, '<br>'),
});
```

## Usage

### How to Send Bulk Emails

1. **Navigate to Leads page** in your dashboard
2. **Select leads** by clicking checkboxes next to their names
3. **Click "Send Email"** button (appears when leads are selected)
4. **Fill in the form:**
   - **From:** Sender name (e.g., "Sales Team")
   - **Subject:** Email subject line
   - **Message:** Email body with optional personalization variables
5. **Click variable buttons** to insert dynamic fields or type them manually
6. **Click "Send {N} Email(s)"** to send

### Template Variables

The following variables are automatically replaced with lead data:

| Variable | Value | Example |
|----------|-------|---------|
| `{name}` | First and last name | "John Smith" |
| `{firstName}` | First name only | "John" |
| `{lastName}` | Last name only | "Smith" |
| `{company}` | Company name | "Acme Corp" |
| `{title}` | Job title | "Sales Manager" |
| `{email}` | Email address | "john@acme.com" |
| `{phone}` | Phone number | "+1-555-0123" |

### Example Email Template

```
Subject: Partnership Opportunity with {company}

Hi {firstName},

I hope this message finds you well! I noticed that {company} is doing great work in your industry, and I think we could create a valuable partnership.

Your background as a {title} makes you a perfect fit for this opportunity.

I'd love to chat more about this. Feel free to reach out at your earliest convenience.

Best regards,
Sales Team
```

**Result for lead "John Smith" at "Acme Corp" with title "Sales Manager":**
```
Subject: Partnership Opportunity with Acme Corp

Hi John,

I hope this message finds you well! I noticed that Acme Corp is doing great work in your industry, and I think we could create a valuable partnership.

Your background as a Sales Manager makes you a perfect fit for this opportunity.

I'd love to chat more about this. Feel free to reach out at your earliest convenience.

Best regards,
Sales Team
```

## Database Schema

### email_campaigns Table
Stores email campaign information:
- `id`: Unique campaign ID
- `user_id`: User who created the campaign
- `name`: Campaign name/description
- `subject`: Email subject
- `message_template`: Email template with variables
- `status`: 'draft', 'sent', or 'failed'
- `total_recipients`: Total leads emailed
- `sent_count`: Successfully sent count
- `failed_count`: Failed send count
- `created_at`: Campaign creation time
- `sent_at`: When campaign was sent

### email_logs Table
Tracks individual email delivery:
- `id`: Unique log ID
- `campaign_id`: Associated campaign
- `lead_id`: Associated lead
- `recipient_email`: Email address
- `recipient_name`: Lead name
- `status`: 'pending', 'sent', or 'failed'
- `error_message`: Error details if failed
- `sent_at`: Delivery timestamp

## Features & Security

### Rate Limiting
By default, emails are sent in sequence. To avoid rate limits with your email service:
- **Resend**: 100 emails/day on free tier
- **SendGrid**: 100 emails/day free tier
- **Nodemailer**: Depends on your email provider

Adjust batch sizes if needed in the API route.

### RLS (Row Level Security)
All campaigns and logs are protected by Row Level Security:
- Users can only view/manage their own campaigns
- Shared workspace members can access shared campaigns
- Audit logs track all email activities

### Error Handling
- Handles missing email addresses gracefully
- Captures specific error messages for failed sends
- Provides success/failure counts in response
- Logs all errors for troubleshooting

## Troubleshooting

### "Failed to send emails"
1. Check API key is set correctly in `.env.local`
2. Verify email service account is active
3. Check email service quota/limits
4. Look at browser console for detailed error messages

### Emails not sending
1. Ensure leads have valid email addresses
2. Check SMTP credentials (for Nodemailer)
3. Verify sender domain is authenticated
4. Check email service dashboard for bounce notifications

### "No email address provided" error
- Some leads don't have email addresses - add them first in the leads detail view

### Rate limit errors
- Reduce batch size or implement delays between sends
- Check your email service's rate limits
- Upgrade your email service plan if needed

## Advanced Configuration

### Custom Email Templates
Modify the HTML template in `app/api/send-bulk-email/route.ts`:

Current:
```typescript
html: `<p>${personalizedMessage.replace(/\n/g, '<br>')}</p>`,
```

Enhanced with styling:
```typescript
html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px;">
    <p>${personalizedMessage.replace(/\n/g, '<br>')}</p>
    <footer style="margin-top: 20px; font-size: 12px; color: #666;">
      <p>Sent by LeadVault</p>
    </footer>
  </div>
`,
```

### Custom Variable Names
Add more variables by updating the `fieldMappings` object:

```typescript
const fieldMappings: Record<string, string[]> = {
  name: ['first_name', 'name'],
  firstName: ['first_name'],
  lastName: ['last_name'],
  company: ['company'],
  title: ['title'],
  email: ['email'],
  phone: ['phone'],
  // Add custom fields here:
  website: ['website'],
  location: ['location'],
  notes: ['notes'],
};
```

### Batch Processing for Large Campaigns
For sending to 1000+ leads, implement batching:

```typescript
const batchSize = 100;
for (let i = 0; i < leads.length; i += batchSize) {
  const batch = leads.slice(i, i + batchSize);
  // Process batch
  await delay(1000); // 1 second delay between batches
}
```

## Support & Resources

- **Resend Docs:** https://resend.com/docs
- **SendGrid Docs:** https://docs.sendgrid.com/
- **Nodemailer:** https://nodemailer.com/
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security

## Next Steps

1. ✅ Choose your email service provider
2. ✅ Add API credentials to `.env.local`
3. ✅ Run database migration
4. ✅ Test with a small batch of emails
5. ✅ Review email logs in the dashboard
6. ✅ Scale to larger campaigns

Happy emailing! 🚀
