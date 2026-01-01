# SMS Feature - Quick Start Guide

## 🚀 Getting Started (5 minutes)

### 1. Add Your SMS API Key
```bash
# Edit your .env file and set:
SMS_API_KEY=your_actual_api_key_from_sms_net_bd
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Test SMS Balance
- Go to Dashboard (`http://localhost:3000/dashboard`)
- Look for "SMS Balance" widget showing BDT balance
- Should refresh every 30 seconds

## 📱 Send Your First Bulk SMS

1. **Navigate to Leads** → Click Leads menu or go to `/dashboard/leads`
2. **Select Recipients** → Checkbox any leads with phone numbers
3. **Send SMS** → Green "Send SMS" button appears
4. **Compose Message** → Type your message with optional template variables:
   - `{firstName}` → John
   - `{lastName}` → Doe
   - `{name}` → John Doe
   - `{email}` → john@example.com
   - `{phone}` → +8801234567890
   - `{company}` → Acme Corp
   - `{title}` → CEO

5. **Review Recipients** → Confirm list shows only leads with phone numbers
6. **Send** → Click Send button
7. **Watch Results** → See success/failure breakdown

## 📊 Track Your Campaigns

1. **Go to SMS Page** → Click SMS menu (`/dashboard/sms`)
2. **View Campaigns** → See all your SMS campaigns with:
   - Campaign name and status badge
   - Message preview (first 2 lines)
   - Sent count, Failed count, Success rate %
3. **View Delivery Report** → Click "View Delivery Report" button
4. **See Details** → Modal shows per-recipient status:
   - Phone number
   - Delivery status (Delivered/Pending/Failed/Rejected)
   - Charge for each SMS

## 🔧 API Endpoints

All endpoints require authentication (user must be logged in).

### Send Bulk SMS
```
POST /api/send-bulk-sms
{
  "leadIds": ["lead-uuid-1", "lead-uuid-2"],
  "message": "Hello {firstName}! Check out {link}"
}

Response: {
  "success": true,
  "campaignId": "uuid",
  "sent": 2,
  "failed": 0,
  "failures": []
}
```

### Check Balance
```
GET /api/sms-balance

Response: {
  "success": true,
  "balance": 1500.50,
  "currency": "BDT"
}
```

### Get Delivery Report
```
GET /api/sms-report/{request_id}

Response: {
  "success": true,
  "requestId": "req-id",
  "status": "Completed",
  "charge": 50,
  "recipients": [
    {
      "number": "+8801234567890",
      "status": "Delivered",
      "charge": 1.5
    }
  ]
}
```

### List Campaigns
```
GET /api/sms-campaigns

Response: {
  "campaigns": [
    {
      "id": "uuid",
      "name": "Campaign Name",
      "message": "SMS text",
      "status": "completed",
      "total": 10,
      "sent": 10,
      "failed": 0,
      "request_id": "req-id",
      "created_at": "2024-12-30T10:00:00Z"
    }
  ]
}
```

## 📋 Template Variables Reference

Available in SMS message:
| Variable | Example Output | Use Case |
|----------|---|---|
| `{firstName}` | John | Personalized greeting |
| `{lastName}` | Doe | Formal reference |
| `{name}` | John Doe | Full name greeting |
| `{email}` | john@example.com | Contact info |
| `{phone}` | +8801234567890 | Callback number |
| `{company}` | Acme Corp | Company context |
| `{title}` | CEO | Position reference |

**Example Message:**
```
Hi {firstName}, {title} at {company} - we have a special offer for you! 
Contact us: {email} or {phone}
```

## ✅ Verification Checklist

- [ ] SMS_API_KEY is set in .env
- [ ] Dashboard loads without errors
- [ ] SMS Balance widget shows current balance
- [ ] SMS menu item appears in navigation
- [ ] Can select leads on Leads page
- [ ] "Send SMS" button appears when leads selected
- [ ] Can open SMS dialog and compose message
- [ ] Template variable buttons work
- [ ] Recipient list only shows leads with phone numbers
- [ ] Can send SMS successfully
- [ ] Campaign appears on SMS page
- [ ] Can view delivery report
- [ ] Per-recipient status shows in report

## 🐛 Troubleshooting

### "SMS service not configured"
- Check `.env` file has `SMS_API_KEY=your_key`
- Restart dev server after changing .env

### "No recipients with phone numbers"
- Ensure selected leads have phone numbers
- Check database/import has phone field populated
- Phone must not be empty or null

### Balance not showing
- Verify SMS_API_KEY is correct
- Check SMS.net.bd account is active
- Look at browser console for API errors

### Campaign appears but delivery report fails
- Some requests may take time to process
- Wait a few seconds and try again
- Some statuses update with delay from SMS provider

### SMS not being sent
- Check lead phone number format (+8801234567890)
- Verify message length (typically max 160 characters)
- Confirm account has sufficient balance
- Check SMS logs in database for error details

## 📚 Database Tables

### sms_campaigns
Stores campaign metadata:
- `id` - Campaign UUID
- `user_id` - Owner's user ID
- `name` - Campaign name
- `message` - SMS text sent
- `status` - completed/pending/failed
- `total` - Total recipients
- `sent` - Successfully sent count
- `failed` - Failed count
- `request_id` - SMS provider's request ID
- `created_at` - Timestamp

### sms_logs
Stores per-recipient delivery info:
- `id` - Log entry UUID
- `campaign_id` - Parent campaign ID
- `lead_id` - Recipient lead ID
- `recipient_phone` - Phone number sent to
- `recipient_name` - Recipient name
- `status` - Delivery status
- `error_message` - Error if failed
- `api_response` - Raw SMS provider response
- `sent_at` - Timestamp

## 🔐 Security Notes

- SMS API key is **never sent to frontend**
- All SMS requests go through backend only
- User can only see their own campaigns (RLS policies)
- Phone numbers validated before sending
- Rate limiting recommended for production

---

**Need Help?** Check [SMS_IMPLEMENTATION_COMPLETE.md](./SMS_IMPLEMENTATION_COMPLETE.md) for detailed architecture and setup.
