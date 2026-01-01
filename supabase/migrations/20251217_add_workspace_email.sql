-- Add workspace_email column to account_members table
ALTER TABLE account_members ADD COLUMN IF NOT EXISTS workspace_email text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_account_members_workspace_email ON account_members(workspace_email);

-- Add UPDATE policy to allow members to update their own member_user_id on first login
DROP POLICY IF EXISTS "Members can update own user id" ON account_members;
CREATE POLICY "Members can update own user id"
  ON account_members FOR UPDATE
  TO authenticated
  USING (member_email = auth.jwt() ->> 'email' AND member_user_id IS NULL)
  WITH CHECK (member_email = auth.jwt() ->> 'email');

