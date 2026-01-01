-- Add sender_name to sms_campaigns and sms_logs

ALTER TABLE sms_campaigns
  ADD COLUMN IF NOT EXISTS sender_name text;

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS sender_name text;

-- Optional: Create indexes if you will query by sender_name
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_sender_name ON sms_campaigns(sender_name);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sender_name ON sms_logs(sender_name);
