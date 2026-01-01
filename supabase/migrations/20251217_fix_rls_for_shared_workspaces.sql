/*
  # Fix RLS Policies for Shared Workspaces
  
  Allow workspace members to access leads and imports in shared workspaces.
  Members should be able to see and modify data for workspaces they have access to.
*/

-- Drop existing policies on leads table
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

-- New policies for leads - owner OR member of workspace
CREATE POLICY "Users can view leads in accessible workspaces"
  ON leads FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = leads.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leads in accessible workspaces"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads in accessible workspaces"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = leads.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete leads in accessible workspaces"
  ON leads FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = leads.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

-- Drop existing policies on imports table
DROP POLICY IF EXISTS "Users can view own imports" ON imports;
DROP POLICY IF EXISTS "Users can insert own imports" ON imports;
DROP POLICY IF EXISTS "Users can update own imports" ON imports;
DROP POLICY IF EXISTS "Users can delete own imports" ON imports;

-- New policies for imports - owner OR member of workspace
CREATE POLICY "Users can view imports in accessible workspaces"
  ON imports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = imports.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert imports in accessible workspaces"
  ON imports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update imports in accessible workspaces"
  ON imports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = imports.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete imports in accessible workspaces"
  ON imports FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM account_members 
      WHERE account_members.workspace_id = imports.user_id 
      AND account_members.member_user_id = auth.uid()
    )
  );

