/*
  # Account Sharing Schema
  
  Allows users to share their account/workspace with other users.
  Each workspace has an owner (user_id) and can have multiple members.
*/

-- Create account_members table
CREATE TABLE IF NOT EXISTS account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_email text,
  member_email text NOT NULL,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owner can view members" ON account_members;
DROP POLICY IF EXISTS "Owner can add members" ON account_members;
DROP POLICY IF EXISTS "Owner can remove members" ON account_members;
DROP POLICY IF EXISTS "Owner can update members" ON account_members;
DROP POLICY IF EXISTS "Members can view workspace" ON account_members;
DROP POLICY IF EXISTS "Members can update own record" ON account_members;

-- Allow workspace owner to view, add, update, delete members
CREATE POLICY "Owner can manage members"
  ON account_members
  TO authenticated
  USING (auth.uid() = workspace_id)
  WITH CHECK (auth.uid() = workspace_id);

-- Allow members to view their workspace
CREATE POLICY "Members can view workspace"
  ON account_members FOR SELECT
  TO authenticated
  USING (auth.uid() = member_user_id OR member_email = auth.jwt() ->> 'email');

-- Allow members to update their own member_user_id on first login
CREATE POLICY "Members can update own user id"
  ON account_members FOR UPDATE
  TO authenticated
  USING (member_email = auth.jwt() ->> 'email' AND member_user_id IS NULL)
  WITH CHECK (member_email = auth.jwt() ->> 'email');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_account_members_workspace ON account_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_account_members_member_user ON account_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_email ON account_members(member_email);
