# MiMSMS Setup Guide

This document explains how to configure LeadVault to use **MiMSMS** as the SMS provider.

## Environment Variables

Add the following to your `.env.local` file:

```bash
# MiMSMS API Configuration
SMS_USERNAME=your-mimsms-email@example.com
SMS_API_KEY=your-mimsms-api-key
```

### Where to Find Your Credentials

1. **SMS_USERNAME**: Your registered MiMSMS email address (used for login)
2. **SMS_API_KEY**: Generated from your MiMSMS account dashboard
   - Log in to [MiMSMS Panel](https://sms.mimsms.com/)
   - Navigate to **Developer Options** or **API Settings**
   - Generate an API Key
   - Copy it to your `.env.local`

## API Endpoints Updated

All SMS API routes have been updated to use MiMSMS:

### 1. Send SMS Endpoint
- **Route**: `POST /api/send-bulk-sms`
- **Base URL**: `https://api.mimsms.com/api/SmsSending/SMS`
- **Request Format**: JSON
- **Features**:
  - Sends personalized SMS to individual leads
  - Supports template variables: `{firstName}`, `{lastName}`, `{name}`, `{company}`, `{title}`, `{phone}`, `{email}`
  - Logs each SMS in the database
  - Returns provider error messages for debugging
  - Transaction Type: `T` (Transactional)

### 2. Check Balance Endpoint
- **Route**: `GET /api/sms-balance`
- **Base URL**: `https://api.mimsms.com/api/SmsSending/balanceCheck`
- **Returns**: Account balance in BDT

### 3. SMS Report Endpoint
- **Route**: `GET /api/sms-report/[id]`
- **Note**: MiMSMS doesn't provide detailed delivery reports via API
- **Alternative**: Use MiMSMS Dashboard at https://sms.mimsms.com/ for delivery reports

## Request/Response Examples

### Send SMS Request
```json
{
  "leads": [
    {
      "id": "lead-1",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "8801844909020",
      "company": "Acme Corp",
      "title": "Manager"
    }
  ],
  "message": "Hello {firstName}, this is a test message from {company}",
  "userId": "user-id",
  "senderName": "LeadVault"
}
```

### Send SMS Response (Success)
```json
{
  "success": true,
  "campaignId": "campaign-uuid",
  "sent": 1,
  "failed": 0,
  "total": 1,
  "message": "1 SMS sent successfully",
  "failures": [],
  "providerError": null,
  "providerErrorMessage": null
}
```

### Send SMS Response (Partial Failure)
```json
{
  "success": true,
  "campaignId": "campaign-uuid",
  "sent": 1,
  "failed": 1,
  "total": 2,
  "message": "1 SMS sent successfully, 1 failed",
  "failures": [
    {
      "lead_id": "lead-2",
      "phone": "8801844909021",
      "name": "Jane Smith",
      "error": "Invalid Sender ID",
      "api_response": {
        "statusCode": "208",
        "status": "Failed",
        "responseResult": "Invalid Sender ID"
      }
    }
  ],
  "providerError": { ... },
  "providerErrorMessage": "Invalid Sender ID"
}
```

## Error Codes

MiMSMS returns the following error codes:

| Code | Status | Description | Action |
|------|--------|-------------|--------|
| 200 | SUCCESS | SMS sent successfully | None |
| 208 | FAILED | Invalid Sender ID | Verify sender name is registered |
| 206 | FAILED | Invalid Mobile Number | Check phone number format |
| 216 | FAILED | Insufficient Balance | Recharge your account |
| 401 | UNAUTHORIZED | Invalid credentials | Verify SMS_USERNAME and SMS_API_KEY |
| 500 | FAILED | Internal Server Error | Contact MiMSMS support |

## Phone Number Format

- **Required Format**: International format without `+` sign
- **Example**: `8801844909020` (for Bangladesh)
- **Pattern**: Country code + Network code + Subscriber number

## Features

✅ Per-recipient SMS sending with personalization
✅ Template variable substitution
✅ Database logging of all SMS
✅ Provider error messages returned to client
✅ Real-time balance checking
✅ SMS campaign tracking
✅ Dashboard widget for balance display

## Testing

### Test Balance Check
```bash
curl -X GET http://localhost:3000/api/sms-balance
```

### Test SMS Send
```bash
curl -X POST http://localhost:3000/api/send-bulk-sms \
  -H "Content-Type: application/json" \
  -d '{
    "leads": [
      {
        "id": "test-1",
        "first_name": "John",
        "phone": "8801844909020"
      }
    ],
    "message": "Test message for {firstName}",
    "userId": "user-id",
    "senderName": "LeadVault"
  }'
```

## Support

For issues or questions:
- MiMSMS Support: support@mimsms.com
- MiMSMS Portal: https://billing.mimsms.com/
- API Documentation: https://www.mimsms.com/api-documentation/

## Migration Notes

If migrating from SMS.net.bd:

1. Update `.env.local` with new credentials (SMS_USERNAME instead of just SMS_API_KEY)
2. Old SMS logs remain in database (not affected)
3. SMS sender name can be configured in the UI
4. Balance widget will show new provider's balance
5. Error messages will reflect MiMSMS error codes
