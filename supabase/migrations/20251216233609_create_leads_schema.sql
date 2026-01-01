/*
  # LeadVault Database Schema

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text, indexed, normalized)
      - `phone` (text, normalized)
      - `linkedin_url` (text, normalized)
      - `company` (text)
      - `title` (text)
      - `website` (text)
      - `location` (text)
      - `notes` (text)
      - `domain` (text, computed from email)
      - `source_file` (text)
      - `import_id` (uuid, foreign key)
      - `is_duplicate` (boolean, default false)
      - `duplicate_group_id` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `imports`
      - `id` (uuid, primary key)
      - `file_name` (text)
      - `total_rows` (integer)
      - `successful_rows` (integer)
      - `failed_rows` (integer)
      - `status` (text)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
    
    - `duplicate_groups`
      - `id` (uuid, primary key)
      - `primary_lead_id` (uuid, foreign key)
      - `match_type` (text: email, linkedin, phone)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their leads
*/

-- Create imports table
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  total_rows integer DEFAULT 0,
  successful_rows integer DEFAULT 0,
  failed_rows integer DEFAULT 0,
  status text DEFAULT 'processing',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imports"
  ON imports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own imports"
  ON imports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imports"
  ON imports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  email text,
  phone text DEFAULT '',
  linkedin_url text DEFAULT '',
  company text DEFAULT '',
  title text DEFAULT '',
  website text DEFAULT '',
  location text DEFAULT '',
  country text DEFAULT '',
  notes text DEFAULT '',
  domain text,
  source_file text DEFAULT '',
  import_id uuid REFERENCES imports(id) ON DELETE SET NULL,
  is_duplicate boolean DEFAULT false,
  duplicate_group_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create duplicate_groups table
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  match_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE duplicate_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own duplicate groups"
  ON duplicate_groups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own duplicate groups"
  ON duplicate_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_linkedin ON leads(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_import_id ON leads(import_id);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_group ON leads(duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_imports_user_id ON imports(user_id);

-- Function to extract domain from email
CREATE OR REPLACE FUNCTION extract_domain_from_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.domain = substring(NEW.email from '@(.*)$');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-extract domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'extract_domain_trigger'
  ) THEN
    CREATE TRIGGER extract_domain_trigger
      BEFORE INSERT OR UPDATE ON leads
      FOR EACH ROW
      EXECUTE FUNCTION extract_domain_from_email();
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at'
  ) THEN
    CREATE TRIGGER update_leads_updated_at
      BEFORE UPDATE ON leads
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;