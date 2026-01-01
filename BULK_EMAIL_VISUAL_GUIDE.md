# Bulk Email Feature - Visual Guide

## User Interface Flow

### Step 1: Leads Page with Selection
```
┌─────────────────────────────────────────────────────────┐
│ Leads                                                   │
│ 125 of 250 leads                                        │
│                                                         │
│ [☑] John Smith     john@acme.com    Sales Manager      │
│ [☑] Jane Doe       jane@techco.com   Director           │
│ [☑] Bob Johnson    bob@startup.io    CTO                │
│ [ ] Alice Williams alice@corp.com    VP Sales           │
│                                                         │
│ Buttons:                                                │
│ [Delete Selected (3)] [Send Email (3)] [Export]        │
│                                                         │
│ ✓ "Send Email" appears when you select leads           │
└─────────────────────────────────────────────────────────┘
```

### Step 2: Click "Send Email" Button
Opens the email composition dialog

### Step 3: Email Dialog Opens
```
┌─────────────────────────────────────────────────────────────┐
│ ✉️ Send Bulk Email                                          │
│ Send personalized emails to 3 selected leads                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Recipients (3)                                             │
│ [John Smith] [Jane Doe] [Bob Johnson]                      │
│                                                             │
│ From (Sender Name)                                         │
│ [LeadVault               ]                                 │
│                                                             │
│ Subject                                                     │
│ [Quick question about your company                 ]       │
│                                                             │
│ Message                                                     │
│ ┌───────────────────────────────────────────────────┐      │
│ │ Hi {firstName},                                   │ (123) │
│ │                                                   │ chars │
│ │ I noticed {company} is doing great work.          │      │
│ │                                                   │      │
│ │ As a {title}, I think we should chat!             │      │
│ │                                                   │      │
│ │ Best regards                                      │      │
│ └───────────────────────────────────────────────────┘      │
│                                                             │
│ Quick Insert Variables                                     │
│ [{name}] [{firstName}] [{lastName}]                        │
│ [{company}] [{title}] [{email}] [{phone}]                 │
│                                                             │
│ ⚠️ Make sure email service configured...                   │
│                                                             │
│ [Cancel] [Send 3 Emails]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Email Sending
```
Progress while sending...

┌─────────────────────────────────────────────────────────┐
│ Sending... ⏳                                            │
│ Processing 3 emails...                                  │
└─────────────────────────────────────────────────────────┘
```

### Step 5: Success Screen
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Emails Sent Successfully!                             │
│                                                         │
│ 3 emails sent successfully                              │
│                                                         │
│ [Close]                                                │
└─────────────────────────────────────────────────────────┘
```

## How Variables Work

### Template Message
```
Hi {firstName},

I noticed {company} is expanding and need to talk about {title} positions.

Your background suggests you'd be perfect.

-Team
```

### For Each Lead, Variables Get Replaced
```
Lead 1: John Smith, Acme Corp, Sales Manager
↓
Hi John,

I noticed Acme Corp is expanding and need to talk about Sales Manager positions.

Your background suggests you'd be perfect.

-Team

---

Lead 2: Jane Doe, TechCo, VP Engineering  
↓
Hi Jane,

I noticed TechCo is expanding and need to talk about VP Engineering positions.

Your background suggests you'd be perfect.

-Team

---

Lead 3: Bob Johnson, Startup.io, CTO
↓
Hi Bob,

I noticed Startup.io is expanding and need to talk about CTO positions.

Your background suggests you'd be perfect.

-Team
```

## Available Variables

```
{name}        → Full name (first + last)
{firstName}   → First name only
{lastName}    → Last name only
{company}     → Company name
{title}       → Job title
{email}       → Email address
{phone}       → Phone number
```

## Database Schema Visualization

```
┌──────────────────────────────────┐
│     email_campaigns              │
├──────────────────────────────────┤
│ id (uuid)                        │
│ user_id (uuid)                   │
│ name (text)                      │
│ subject (text)                   │
│ message_template (text)          │
│ status (sent/failed)             │
│ total_recipients (int)           │
│ sent_count (int)                 │
│ failed_count (int)               │
│ created_at (timestamp)           │
│ sent_at (timestamp)              │
└────────────────┬─────────────────┘
                 │ 1:N
                 ↓
┌──────────────────────────────────┐
│      email_logs                  │
├──────────────────────────────────┤
│ id (uuid)                        │
│ campaign_id (uuid) [FK]          │
│ lead_id (uuid) [FK]              │
│ recipient_email (text)           │
│ recipient_name (text)            │
│ status (sent/failed/pending)     │
│ error_message (text, nullable)   │
│ sent_at (timestamp)              │
│ created_at (timestamp)           │
└──────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────┐
│   User Interaction      │
│ 1. Select leads         │
│ 2. Click "Send Email"   │
│ 3. Fill form            │
│ 4. Click send           │
└────────────┬────────────┘
             │
             ↓
     ┌───────────────┐
     │ Client-side   │
     │ Validation    │
     └───────┬───────┘
             │
             ↓
    ┌────────────────────┐
    │ POST Request       │
    │ /api/send-bulk...  │
    │ with leads & msg   │
    └────────┬───────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │ API Route Processing               │
    │ 1. Create campaign record          │
    │ 2. Loop through leads              │
    │ 3. Replace variables               │
    │ 4. Send via email service          │
    │ 5. Log each result                 │
    │ 6. Update campaign counts          │
    └────────┬───────────────────────────┘
             │
             ├─→ ┌──────────────────────┐
             │   │ Email Service        │
             │   │ (Resend/SendGrid)    │
             │   └──────────────────────┘
             │
             └─→ ┌──────────────────────┐
                 │ Supabase Database    │
                 │ email_campaigns      │
                 │ email_logs           │
                 └──────────────────────┘
             │
             ↓
    ┌────────────────────┐
    │ Return Response    │
    │ {sent: 3,          │
    │  failed: 0,        │
    │  total: 3}         │
    └────────┬───────────┘
             │
             ↓
    ┌────────────────────┐
    │ Success Dialog     │
    │ "3 sent, 0 failed" │
    └────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────┐
│        LeadVault Application            │
├─────────────────────────────────────────┤
│                                         │
│  Dashboard Layout                       │
│  ├── Leads Page ←─ NEW INTEGRATION      │
│  │   ├── Lead Table                     │
│  │   ├── Selection Checkboxes           │
│  │   ├── Delete Button                  │
│  │   ├── Export Button                  │
│  │   └── ✨ Send Email Button (NEW)     │
│  │                                      │
│  │   └─→ Opens BulkEmailDialog (NEW)    │
│  │       ├── Form Input                 │
│  │       ├── Template Variables         │
│  │       └── Send Handler               │
│  │           └─→ POST /api/...          │
│  │               └─→ Supabase           │
│  │               └─→ Email Service      │
│  │                                      │
│  ├── Settings                           │
│  ├── Import                             │
│  └── Add Lead                           │
│                                         │
└─────────────────────────────────────────┘
```

## File Structure

```
LeadVault-1.0/
│
├── 📄 SETUP_FOR_BULK_EMAIL.md (This guide)
├── 📄 BULK_EMAIL_SETUP.md (Detailed setup)
├── 📄 BULK_EMAIL_QUICK_REFERENCE.md
├── 📄 EMAIL_SERVICE_SETUP.md
├── 📄 BULK_EMAIL_IMPLEMENTATION.md
│
├── app/
│   ├── api/
│   │   ├── imports/
│   │   ├── fetch-sheet/
│   │   └── 📧 send-bulk-email/ (NEW)
│   │       └── route.ts ← API endpoint
│   │
│   └── dashboard/
│       └── leads/
│           └── page.tsx ← Updated
│
├── components/
│   ├── 📧 bulk-email-dialog.tsx (NEW)
│   ├── dashboard-layout.tsx
│   └── ui/
│
└── supabase/
    └── migrations/
        └── 📧 20251230_add_email_campaigns.sql (NEW)
```

## Setup Timeline

```
Step 1: Install Package
npm install resend
↓ (1 minute)

Step 2: Add API Key
Add to .env.local
↓ (1 minute)

Step 3: Database Migration
Run SQL in Supabase
↓ (2 minutes)

Step 4: Restart Server
npm run dev
↓ (1 minute)

Step 5: Test
Select leads → Click button → Send
↓ (2 minutes)

Total: ~7 minutes
```

## Success Metrics

Track these to measure success:

```
📊 Metrics Dashboard
├── Total Campaigns Sent
│   └── 25 campaigns
├── Total Emails Sent
│   └── 500 emails
├── Success Rate
│   └── 98% (490 sent, 10 failed)
├── Avg. Delivery Time
│   └── 2.3 seconds per email
└── Campaign Performance
    ├── Campaign 1: 5 sent, 0 failed
    ├── Campaign 2: 10 sent, 1 failed
    └── Campaign 3: 3 sent, 0 failed
```

## Troubleshooting Decision Tree

```
Email not sending?
│
├─ No "Send Email" button?
│  └─ Did you select leads? (Need ≥1)
│
├─ Button showing but can't send?
│  ├─ Fill subject? (required)
│  ├─ Fill message? (required)
│  └─ Check browser console
│
├─ Getting API error 500?
│  ├─ Check .env.local has API key
│  ├─ Did you restart server? (npm run dev)
│  └─ Check email service status
│
├─ Email service error?
│  ├─ Valid API key?
│  ├─ Email service account active?
│  └─ Check email service dashboard
│
└─ Emails sent but not received?
    ├─ Check email_logs in database
    ├─ Check email service dashboard
    ├─ Check spam/junk folder
    └─ Verify SMTP authentication
```

## Quick Start Visual

```
🟢 READY TO SEND

1️⃣  INSTALL (1 min)
   npm install resend

2️⃣  CONFIGURE (1 min)
   Add to .env.local:
   RESEND_API_KEY=re_...

3️⃣  MIGRATE (2 min)
   Run SQL in Supabase

4️⃣  RESTART (1 min)
   npm run dev

5️⃣  TEST (2 min)
   Go to Leads → Select → Send

✅ DONE! You're ready to send bulk emails
```

---

**Visual Guide Created**: December 30, 2025
**Status**: Complete and Ready to Use
