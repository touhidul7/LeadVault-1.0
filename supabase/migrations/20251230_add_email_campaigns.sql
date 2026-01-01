/*
  # Email Campaigns and History

  1. New Tables
    - `email_campaigns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `subject` (text)
      - `message_template` (text)
      - `status` (text: 'draft', 'sent', 'failed')
      - `total_recipients` (integer)
      - `sent_count` (integer)
      - `failed_count` (integer)
      - `created_at` (timestamptz)
      - `sent_at` (timestamptz, nullable)
    
    - `email_logs`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key)
      - `lead_id` (uuid, foreign key)
      - `recipient_email` (text)
      - `recipient_name` (text)
      - `status` (text: 'pending', 'sent', 'failed')
      - `error_message` (text, nullable)
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own campaigns and logs
*/

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text DEFAULT '',
  message_template text NOT NULL,
  status text DEFAULT 'draft',
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('draft', 'sent', 'failed'))
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns"
  ON email_campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
  ON email_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON email_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON email_campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text DEFAULT '',
  status text DEFAULT 'pending',
  error_message text,
  provider_response text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_log_status CHECK (status IN ('pending', 'sent', 'failed'))
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaign logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM email_campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own campaign logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM email_campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own campaign logs"
  ON email_logs FOR UPDATE
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM email_campaigns WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM email_campaigns WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_email_campaigns_user_id ON email_campaigns(user_id);
CREATE INDEX idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
