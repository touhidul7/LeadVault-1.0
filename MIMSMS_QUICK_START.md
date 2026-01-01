# Quick Start - MiMSMS Configuration

## 1. Get Your MiMSMS Credentials

**Step 1:** Go to [MiMSMS Panel](https://sms.mimsms.com/)
- Sign in with your email and password

**Step 2:** Navigate to **Settings → Developer Options** or **API Settings**
- Find your **API Key**
- Copy it somewhere safe

**Step 3:** Your **Username** is your registered email address

## 2. Update .env.local

Add these two lines to your `.env.local` file:

```bash
SMS_USERNAME=your-email@mimsms.com
SMS_API_KEY=your-actual-api-key-here
```

**Example:**
```bash
SMS_USERNAME=john@example.com
SMS_API_KEY=ABC123XYZ789DEFGHIJKLMNOP
```

## 3. Restart Dev Server

```bash
npm run dev
```

## 4. Test It Out

### Check Balance
- Go to Dashboard
- Look for "SMS Balance" widget
- Should show your account balance

### Send a Test SMS
1. Go to **Dashboard → Leads**
2. Select one or more leads
3. Click **Send SMS** button
4. Type a message (can use {firstName}, {lastName}, etc.)
5. Click **Send**

### View SMS History
- Go to **Dashboard → SMS**
- See all your campaigns and status

## 5. Phone Number Format

MiMSMS requires phone numbers in **international format without +**:

**Correct:**
- `8801844909020` (Bangladesh)
- `919876543210` (India)
- `441234567890` (UK)

**Incorrect:**
- `+8801844909020` (has +)
- `01844909020` (missing country code)

## Common Issues

### "Invalid Sender ID"
- Register a sender name in MiMSMS dashboard
- Make sure it's approved before using

### "Insufficient Balance"
- Recharge at: https://billing.mimsms.com/clientarea.php?action=addfunds

### "Invalid Mobile Number"
- Check phone number format (must be international format without +)
- Verify the number is correct

### "Unauthorized"
- Check SMS_USERNAME and SMS_API_KEY are correct
- Make sure there's no extra whitespace

## Useful Links

| Link | Purpose |
|------|---------|
| https://sms.mimsms.com/ | Main SMS Panel |
| https://billing.mimsms.com/ | Recharge Account |
| https://www.mimsms.com/api-documentation/ | Full API Docs |
| support@mimsms.com | Technical Support |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/SmsSending/SMS` | POST | Send SMS |
| `/api/SmsSending/OneToMany` | POST | Send to multiple |
| `/api/SmsSending/balanceCheck` | POST | Check balance |

All endpoints are under `https://api.mimsms.com`

---

**Questions?** Check `MIMSMS_SETUP.md` for detailed documentation.
