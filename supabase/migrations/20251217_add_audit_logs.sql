-- Create audit_logs table to track activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, -- create, update, delete, import, copy
  table_name text NOT NULL,
  record_id uuid,
  actor_id uuid,
  actor_email text,
  workspace_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own audit logs
DROP POLICY IF EXISTS "Authenticated can insert own audit" ON audit_logs;
CREATE POLICY "Authenticated can insert own audit"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Allow owners and workspace members to SELECT logs for a workspace
DROP POLICY IF EXISTS "Workspace members can view logs" ON audit_logs;
CREATE POLICY "Workspace members can view logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR workspace_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.workspace_id = audit_logs.workspace_id
      AND account_members.member_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
