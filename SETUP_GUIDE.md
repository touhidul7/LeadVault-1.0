# LeadVault Setup Guide

This guide will walk you through setting up LeadVault from scratch.

## Prerequisites

- Node.js 18+ installed on your machine
- A Supabase account (free tier available at https://supabase.com)
- Basic familiarity with the command line

## Step-by-Step Setup

### Step 1: Supabase Project Setup

1. **Create a Supabase Account**
   - Go to https://supabase.com
   - Click "Start your project"
   - Sign up with GitHub, Google, or email

2. **Create a New Project**
   - Click "New Project"
   - Choose your organization
   - Enter a project name (e.g., "LeadVault")
   - Create a strong database password (save this securely)
   - Choose a region close to you
   - Click "Create new project"
   - Wait 2-3 minutes for project setup

3. **Get Your Project Credentials**
   - Once the project is ready, go to Settings → API
   - Find and copy:
     - **Project URL** (looks like: https://xxxxx.supabase.co)
     - **anon/public key** (long string starting with "eyJ...")

4. **Verify Database Setup**
   - Go to "Database" → "Tables" in the Supabase dashboard
   - You should see three tables: `leads`, `imports`, and `duplicate_groups`
   - These were created automatically by the migration

### Step 2: Configure Authentication

1. **Email Authentication Settings**
   - In Supabase dashboard, go to Authentication → Providers
   - Ensure "Email" provider is enabled
   - Go to Authentication → Email Templates
   - For development, you can disable email confirmation:
     - Go to Authentication → Settings
     - Scroll to "Email Auth"
     - Toggle OFF "Enable email confirmations" (for development only)

### Step 3: Local Project Setup

1. **Navigate to Project Directory**
   ```bash
   cd /path/to/your/project
   ```

2. **Configure Environment Variables**
   - Open the `.env.local` file in the project root
   - Replace the placeholder values:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

### Step 4: Run the Application

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Open the Application**
   - Open your browser to http://localhost:3000
   - You should see the LeadVault landing page with a loading spinner
   - It will redirect you to the login page

### Step 5: Create Your First Account

1. **Sign Up**
   - Click "Sign up" on the login page
   - Enter your email and password (minimum 6 characters)
   - Click "Create Account"
   - You'll be redirected to the login page

2. **Sign In**
   - Enter your email and password
   - Click "Sign In"
   - You'll be redirected to the dashboard

### Step 6: Import Your First Leads

1. **Prepare Your CSV File**
   - You can use the included `sample-leads.csv` file
   - Or create your own CSV with at minimum an "email" column
   - Supported columns: First Name, Last Name, Email, Phone, LinkedIn, Company, Title, Website, Location, Notes

2. **Import the CSV**
   - Click "Import" in the navigation menu
   - Click the file input or drag and drop your CSV file
   - Click "Import" button
   - Watch the progress bar as leads are imported
   - Review the import results

3. **View Your Leads**
   - Click "Leads" in the navigation menu
   - You should see all imported leads
   - Try the search and filter features

## Verification Checklist

After setup, verify these features work:

- [ ] Sign up creates a new account
- [ ] Sign in with correct credentials works
- [ ] Dashboard shows metrics (all should be 0 initially)
- [ ] Import page accepts CSV files
- [ ] Leads are successfully imported
- [ ] Leads page displays imported data
- [ ] Search functionality works
- [ ] Export to CSV works
- [ ] Delete lead functionality works
- [ ] Sign out redirects to login page

## Common Issues and Solutions

### Issue: "Invalid Supabase URL"
**Solution**: Ensure you've updated `.env.local` with your actual Supabase credentials from Step 1.3

### Issue: Import fails with "Failed to fetch"
**Solution**:
1. Check that your Supabase project is active
2. Verify the API key hasn't expired
3. Check browser console for specific error messages

### Issue: "Email rate limit exceeded"
**Solution**: This is Supabase's rate limiting. Wait a few minutes before trying again, or upgrade your Supabase plan.

### Issue: Can't see imported leads
**Solution**:
1. Check that RLS policies are properly set up in Supabase
2. Verify you're logged in with the same account that imported the leads
3. Check the browser console for errors

### Issue: Build fails during deployment
**Solution**:
1. Ensure all environment variables are set in your deployment platform
2. The build warnings about Supabase URL during static generation are normal and can be ignored

## Database Schema Details

### leads Table
```sql
- id (uuid, primary key)
- first_name (text)
- last_name (text)
- email (text, required, indexed)
- phone (text, indexed)
- linkedin_url (text, indexed)
- company (text, indexed)
- title (text)
- website (text)
- location (text)
- notes (text)
- domain (text, auto-generated, indexed)
- source_file (text)
- import_id (uuid, foreign key)
- is_duplicate (boolean)
- duplicate_group_id (uuid)
- user_id (uuid, foreign key)
- created_at (timestamp)
- updated_at (timestamp)
```

### imports Table
```sql
- id (uuid, primary key)
- file_name (text)
- total_rows (integer)
- successful_rows (integer)
- failed_rows (integer)
- status (text)
- user_id (uuid, foreign key)
- created_at (timestamp)
```

### duplicate_groups Table
```sql
- id (uuid, primary key)
- primary_lead_id (uuid, foreign key)
- match_type (text)
- user_id (uuid, foreign key)
- created_at (timestamp)
```

## Security Best Practices

1. **Never commit `.env.local` to version control**
   - It's included in `.gitignore` by default
   - Always use environment variables for sensitive data

2. **Use strong passwords**
   - For Supabase database: 20+ characters with mix of characters
   - For user accounts: Minimum 8 characters (enforced at 6 for development)

3. **Keep dependencies updated**
   ```bash
   npm update
   ```

4. **Enable email confirmation in production**
   - Go to Supabase Authentication → Settings
   - Enable "Enable email confirmations"

## Production Deployment

### Option 1: Netlify (Recommended)

1. **Connect Repository**
   - Push your code to GitHub
   - Go to Netlify and click "New site from Git"
   - Select your repository

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - These are pre-configured in `netlify.toml`

3. **Set Environment Variables**
   - In Netlify dashboard, go to Site settings → Environment variables
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your site will be live at `your-site-name.netlify.app`

### Option 2: Vercel

1. **Import Project**
   - Go to Vercel and click "New Project"
   - Import your GitHub repository

2. **Configure**
   - Framework preset: Next.js
   - Add environment variables

3. **Deploy**
   - Click "Deploy"
   - Your site will be live at `your-site.vercel.app`

## Next Steps

After successful setup:

1. **Import Real Data**
   - Prepare your CSV files with lead information
   - Import them through the application

2. **Customize**
   - Modify the color scheme in `tailwind.config.ts`
   - Update branding and logos
   - Add custom fields if needed

3. **Set Up Backups**
   - Configure Supabase automatic backups (available in paid plans)
   - Or set up regular exports of your data

4. **Monitor Usage**
   - Check Supabase dashboard for database size
   - Monitor API request counts
   - Upgrade plan if needed

## Support Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **TailwindCSS Documentation**: https://tailwindcss.com/docs
- **shadcn/ui Components**: https://ui.shadcn.com

## Getting Help

If you encounter issues not covered in this guide:

1. Check the browser console for error messages
2. Review the Supabase logs in the dashboard
3. Ensure all environment variables are correctly set
4. Verify your Supabase project is active and not paused

---

**Congratulations!** You now have a fully functional LeadVault application. Start importing leads and managing your database efficiently.
