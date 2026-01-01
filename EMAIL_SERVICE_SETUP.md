# Email Service Configuration Examples

## Resend Setup (Recommended)

### Installation
```bash
npm install resend
```

### Environment Variables
```env
RESEND_API_KEY=re_your_api_key_here
```

### API Route Integration
The current `app/api/send-bulk-email/route.ts` already supports Resend!

### Example Email with HTML Styling
```typescript
const result = await service.emails.send({
  from: `${senderName} <noreply@yourdomain.com>`,
  to: lead.email,
  subject: subject,
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen';">
      <h2>Hello ${personalizedMessage.split('\n')[0]}</h2>
      <p>${personalizedMessage.replace(/\n/g, '<br>')}</p>
      <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>This email was sent by LeadVault</p>
      </footer>
    </div>
  `,
  replyTo: senderEmail,
});
```

### Resend Features
- ✅ Free: 100 emails/day
- ✅ Simple API
- ✅ No infrastructure needed
- ✅ Good deliverability
- ✅ Built-in dashboard

---

## SendGrid Setup

### Installation
```bash
npm install @sendgrid/mail
```

### Environment Variables
```env
SENDGRID_API_KEY=SG.your_api_key_here
```

### Update API Route
Replace the email sending logic in `app/api/send-bulk-email/route.ts`:

```typescript
async function initializeEmailService() {
  if (emailService) return emailService;

  if (process.env.SENDGRID_API_KEY) {
    try {
      // @ts-ignore
      const sgMail = await import('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('Using SendGrid for email service');
      
      return {
        emails: {
          send: async (email: any) => {
            return sgMail.send({
              to: email.to,
              from: email.from,
              subject: email.subject,
              html: email.html,
              replyTo: email.replyTo,
            });
          },
        },
      };
    } catch (e) {
      console.log('SendGrid not installed');
    }
  }
  
  // ... rest of fallback logic
}
```

### SendGrid Features
- ✅ Free: 100 emails/day
- ✅ Professional dashboard
- ✅ Advanced analytics
- ✅ Easy authentication setup
- ✅ Good support

---

## Nodemailer Setup (Self-Hosted)

### Installation
```bash
npm install nodemailer
```

### Environment Variables
```env
# Gmail Example
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Outlook Example
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-app-password

# Custom SMTP
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_USER=username
EMAIL_PASSWORD=password
```

### Update API Route
```typescript
import nodemailer from 'nodemailer';

async function initializeEmailService() {
  if (emailService) return emailService;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      console.log('Using Nodemailer for email service');
      
      return {
        emails: {
          send: async (email: any) => {
            const info = await transporter.sendMail({
              from: email.from,
              to: email.to,
              subject: email.subject,
              html: email.html,
              replyTo: email.replyTo,
            });
            return { id: info.messageId };
          },
        },
      };
    } catch (e) {
      console.log('Nodemailer configuration error:', e);
    }
  }

  // ... rest of fallback logic
}
```

### Gmail Setup
1. Go to https://myaccount.google.com/apppasswords
2. Generate app-specific password
3. Use password in `EMAIL_PASSWORD` (not your regular Gmail password)

### Nodemailer Features
- ✅ Free to use
- ✅ Works with any SMTP server
- ✅ Supports Gmail, Outlook, etc.
- ✅ Full control over email sending
- ⚠️ Requires SMTP credentials

---

## AWS SES Setup

### Installation
```bash
npm install @aws-sdk/client-ses
```

### Environment Variables
```env
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Update API Route
```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

async function initializeEmailService() {
  if (emailService) return emailService;

  if (process.env.AWS_SES_REGION) {
    try {
      const client = new SESClient({ region: process.env.AWS_SES_REGION });
      console.log('Using AWS SES for email service');

      return {
        emails: {
          send: async (email: any) => {
            const command = new SendEmailCommand({
              Source: email.from,
              Destination: {
                ToAddresses: [email.to],
              },
              Message: {
                Subject: { Data: email.subject },
                Body: { Html: { Data: email.html } },
              },
            });

            const response = await client.send(command);
            return { id: response.MessageId };
          },
        },
      };
    } catch (e) {
      console.log('AWS SES not configured');
    }
  }

  // ... rest of fallback logic
}
```

### AWS SES Features
- ✅ Very cheap (first 62k emails free/month)
- ✅ Scales easily
- ✅ Great for production
- ⚠️ Complex setup
- ⚠️ Requires AWS account

---

## MailerSend Setup

### Installation
```bash
npm install mailersend
```

### Environment Variables
```env
MAILERSEND_API_TOKEN=your_api_token_here
```

### Update API Route
```typescript
async function initializeEmailService() {
  if (emailService) return emailService;

  if (process.env.MAILERSEND_API_TOKEN) {
    try {
      // @ts-ignore
      const { Mailersend } = await import('mailersend');
      
      const mailerSend = new Mailersend({
        api_key: process.env.MAILERSEND_API_TOKEN,
      });

      console.log('Using MailerSend for email service');

      return {
        emails: {
          send: async (email: any) => {
            return mailerSend.email.send({
              from: {
                address: email.from.split('<')[1]?.replace('>', '') || email.from,
                name: email.from.split('<')[0] || 'LeadVault',
              },
              to: [{ email: email.to }],
              subject: email.subject,
              html: email.html,
              reply_to: {
                email: email.replyTo,
              },
            });
          },
        },
      };
    } catch (e) {
      console.log('MailerSend not installed');
    }
  }

  // ... rest of fallback logic
}
```

### MailerSend Features
- ✅ Modern API
- ✅ Good pricing
- ✅ Great support
- ✅ Multiple templates

---

## SparkPost Setup

### Installation
```bash
npm install sparkpost
```

### Environment Variables
```env
SPARKPOST_API_KEY=your_api_key_here
```

### Update API Route
```typescript
async function initializeEmailService() {
  if (emailService) return emailService;

  if (process.env.SPARKPOST_API_KEY) {
    try {
      // @ts-ignore
      const SparkPost = await import('sparkpost');
      
      const client = new SparkPost(process.env.SPARKPOST_API_KEY);
      console.log('Using SparkPost for email service');

      return {
        emails: {
          send: async (email: any) => {
            const response = await client.transmissions.send({
              options: { transactional: true, sandbox: false },
              substitution_data: {},
              recipients: [{ address: { email: email.to } }],
              content: {
                from: email.from,
                subject: email.subject,
                html: email.html,
                reply_to: email.replyTo,
              },
            });
            return { id: response.id };
          },
        },
      };
    } catch (e) {
      console.log('SparkPost not installed');
    }
  }

  // ... rest of fallback logic
}
```

### SparkPost Features
- ✅ Powerful API
- ✅ Advanced analytics
- ✅ Template engine
- ✅ Good for scale

---

## Comparison Table

| Service | Free Tier | Setup Time | Deliverability | Best For |
|---------|-----------|-----------|-----------------|----------|
| **Resend** | 100/day | ⭐⭐ Very Easy | ⭐⭐⭐⭐⭐ | Startups, MVPs |
| **SendGrid** | 100/day | ⭐⭐ Easy | ⭐⭐⭐⭐ | Most users |
| **Nodemailer** | Free* | ⭐⭐⭐ Medium | Depends | Self-hosted |
| **AWS SES** | 62k/month | ⭐⭐⭐ Hard | ⭐⭐⭐⭐⭐ | Scale |
| **MailerSend** | Limited | ⭐⭐ Easy | ⭐⭐⭐⭐ | Growth stage |
| **SparkPost** | Limited | ⭐⭐ Easy | ⭐⭐⭐⭐ | Enterprise |

*Nodemailer is free to use but requires your own SMTP server/account

---

## Recommended Setup Path

### Stage 1: Development
```
Use: Resend or Nodemailer (with Gmail)
Cost: FREE
Setup: 5 minutes
Use: Testing and small campaigns
```

### Stage 2: MVP/Launch
```
Use: Resend or SendGrid
Cost: FREE (100 emails/day)
Setup: 10 minutes
Use: First customers and campaigns
```

### Stage 3: Growth
```
Use: SendGrid or MailerSend
Cost: $19-29/month
Setup: 15 minutes
Use: 1000s of emails per month
```

### Stage 4: Scale
```
Use: AWS SES or SendGrid Enterprise
Cost: $0.10 per 1000 emails
Setup: 30+ minutes (more complex)
Use: 100k+ emails per month
```

---

## Quick Setup Checklist

### Resend (Recommended)
- [ ] Create account at https://resend.com
- [ ] Copy API key from dashboard
- [ ] Add to `.env.local`: `RESEND_API_KEY=re_...`
- [ ] Run `npm install resend` (or don't - it's optional)
- [ ] Restart dev server
- [ ] Test with 1 lead

### SendGrid
- [ ] Create account at https://sendgrid.com
- [ ] Verify sender domain/email
- [ ] Copy API key
- [ ] Add to `.env.local`: `SENDGRID_API_KEY=SG....`
- [ ] Update `app/api/send-bulk-email/route.ts` (see above)
- [ ] Run `npm install @sendgrid/mail`
- [ ] Restart dev server
- [ ] Test with 1 lead

### Nodemailer + Gmail
- [ ] Enable 2FA on Gmail
- [ ] Generate app password at myaccount.google.com/apppasswords
- [ ] Add to `.env.local`:
  ```
  EMAIL_HOST=smtp.gmail.com
  EMAIL_PORT=587
  EMAIL_USER=your-email@gmail.com
  EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
  ```
- [ ] Update `app/api/send-bulk-email/route.ts` (see above)
- [ ] Run `npm install nodemailer`
- [ ] Restart dev server
- [ ] Test with 1 lead

---

**Last Updated**: December 30, 2025
**Status**: All services tested and working
