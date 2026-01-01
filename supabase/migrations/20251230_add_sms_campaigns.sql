/*
  # SMS Campaigns and History

  1. New Tables
    - `sms_campaigns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `message` (text)
      - `status` (text: 'draft', 'sent', 'failed')
      - `total_recipients` (integer)
      - `sent_count` (integer)
      - `failed_count` (integer)
      - `request_id` (text, from SMS API)
      - `created_at` (timestamptz)
      - `sent_at` (timestamptz, nullable)
    
    - `sms_logs`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `lead_id` (uuid, foreign key)
      - `recipient_phone` (text)
      - `recipient_name` (text)
      - `status` (text: 'pending', 'sent', 'failed')
      - `error_message` (text, nullable)
      - `api_response` (jsonb, nullable)
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own campaigns and logs
*/

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'draft',
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  request_id text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT valid_sms_status CHECK (status IN ('draft', 'sent', 'failed'))
);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SMS campaigns"
  ON sms_campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own SMS campaigns"
  ON sms_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SMS campaigns"
  ON sms_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own SMS campaigns"
  ON sms_campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_name text DEFAULT '',
  status text DEFAULT 'pending',
  error_message text,
  api_response jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_sms_log_status CHECK (status IN ('pending', 'sent', 'failed'))
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SMS campaign logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM sms_campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own SMS campaign logs"
  ON sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM sms_campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own SMS campaign logs"
  ON sms_logs FOR UPDATE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM sms_campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own SMS campaign logs"
  ON sms_logs FOR DELETE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM sms_campaigns WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_sms_campaigns_user_id ON sms_campaigns(user_id);
CREATE INDEX idx_sms_campaigns_status ON sms_campaigns(status);
CREATE INDEX idx_sms_logs_campaign_id ON sms_logs(campaign_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
