# Fix Account Switching Issue

The account switching feature wasn't working because the code was trying to fetch workspace owner details using `supabase.auth.admin.getUserById()`, which requires a service-role key and can't be used client-side.

**Solution**: Store the workspace owner's email directly in the `account_members` table.

## Steps to Fix

### 1. Run Migration in Supabase

Go to your Supabase project dashboard:
1. Click "SQL Editor" in the sidebar
2. Click "New Query"
3. Copy and paste this SQL:

```sql
-- Add workspace_email column to account_members table
ALTER TABLE account_members ADD COLUMN IF NOT EXISTS workspace_email text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_account_members_workspace_email ON account_members(workspace_email);
```

4. Click "Run"
5. Verify it says "Success"

### 2. Verify Changes

The code changes have already been applied:
- ✅ `supabase/migrations/20251217_add_account_sharing.sql` - Updated table schema
- ✅ `supabase/migrations/20251217_add_workspace_email.sql` - New migration for the column
- ✅ `components/dashboard-layout.tsx` - Simplified `fetchWorkspaces()` to use stored email
- ✅ `app/dashboard/settings/page.tsx` - Now saves `workspace_email` when inviting

### 3. Test the Fix

1. **First user (owner)**:
   - Log in with your main account
   - Go to Settings
   - Invite a second user by email (e.g., test@example.com)

2. **Second user**:
   - Sign up with the invited email
   - Log in
   - Click the "Login as:" dropdown in the top right
   - You should now see **both**:
     - Your own workspace (the invited email)
     - The owner's workspace (the owner's email)

3. **Switch workspace**:
   - Click on the owner's workspace in the dropdown
   - You should see the owner's leads, imports, etc.
   - Click back to your workspace to switch back

## What Changed

### Database
- Added `workspace_email text` column to `account_members` table
- When inviting a user, the owner's email is now stored in `workspace_email`

### Dashboard Layout
- **Before**: Tried to fetch owner details with `supabase.auth.admin.getUserById()` (doesn't work client-side)
- **After**: Queries `account_members` table directly and reads `workspace_email` from the row

### Result
- No more API calls to `auth.admin`
- Simpler, faster code
- Works entirely with RLS policies

## Troubleshooting

If it still doesn't work:

1. **Check that migration ran**: In Supabase, go to "Database" → "account_members" table and verify the `workspace_email` column exists

2. **Check that workspace_email is populated**: Run this query in Supabase SQL Editor:
   ```sql
   SELECT member_email, workspace_email, member_user_id 
   FROM account_members;
   ```
   You should see workspace_email filled in for all rows.

3. **Clear browser cache**: The UI may be cached. Try incognito/private mode or clear localStorage:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.clear()`
   - Refresh the page

4. **Test with fresh accounts**: Create new test accounts to ensure everything works from scratch
