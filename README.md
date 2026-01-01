# LeadVault - Lead Management System

A comprehensive lead management application built with Next.js and Supabase. LeadVault helps you centralize, search, deduplicate, and export lead data from multiple CSV sources.

## Features

- **Authentication**: Secure email/password authentication powered by Supabase
- **CSV Import**: Upload and process CSV files with automatic field mapping
- **Smart Deduplication**: Automatically detect and flag duplicate leads based on email, LinkedIn, or phone
- **Advanced Search**: Filter leads by name, email, company, title, and more
- **Data Export**: Export filtered or selected leads to CSV
- **Analytics Dashboard**: View key metrics about your lead database
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 13, React, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui component library
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **Deployment**: Netlify-ready with configuration included

## Database Schema

The application uses three main tables:

### leads
- Stores all lead information with normalized fields
- Includes automatic domain extraction from email
- Supports duplicate flagging and grouping
- Tracks source file and import batch

### imports
- Tracks each CSV import operation
- Records success/failure metrics
- Links to user who performed the import

### duplicate_groups
- Manages duplicate lead relationships
- Supports multiple matching strategies (email, LinkedIn, phone)

## Setup Instructions

### 1. Configure Supabase

1. Create a Supabase project at https://supabase.com
2. The database schema has been automatically created via migrations
3. Copy your Supabase URL and anon key from the project settings

### 2. Environment Variables

Update the `.env.local` file with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Build for Production

```bash
npm run build
npm run start
```

## CSV Import Format

The application supports flexible CSV formats with automatic column mapping:

### Required Fields
- **Email** (required for each lead)

### Supported Column Names
- First Name, FirstName, fname → first_name
- Last Name, LastName, lname → last_name
- Email, Email Address → email
- Phone, Phone Number, Mobile → phone
- LinkedIn, LinkedIn URL → linkedin_url
- Company, Company Name, Organization → company
- Title, Job Title, Position → title
- Website, Company Website → website
- Location, City → location
- Notes, Description → notes

### Import Features
- Automatic email normalization (lowercase, trimmed)
- Phone number formatting (digits only)
- LinkedIn URL standardization
- Duplicate detection by email
- Batch processing for large files
- Progress tracking during import

## Key Features Explained

### Authentication
- Secure signup and login with email/password
- Session management with Supabase Auth
- Protected routes with automatic redirection

### Lead Management
- View all leads in a paginated table
- Search across multiple fields simultaneously
- Filter by company or source file
- Select individual or all leads for batch actions
- Delete leads with confirmation dialog
- Export selected or all leads to CSV

### Import System
- Drag-and-drop or click to upload CSV files
- Real-time progress tracking
- Detailed import results (successful, failed, duplicates)
- Preserves source file name for tracking
- Automatic duplicate detection during import

### Dashboard Analytics
- Total leads count
- Total imports count
- Duplicate leads count
- Recent leads (last 7 days)
- Quick action shortcuts

## Security Features

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Secure authentication with Supabase Auth
- Environment variables for sensitive data
- No direct database access from client

## Performance Optimizations

- Indexed columns for fast queries (email, phone, LinkedIn, domain, company)
- Automatic domain extraction via database trigger
- Batch processing for large imports
- Efficient filtering and search queries

## Deployment

The application is configured for Netlify deployment:

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Set environment variables in Netlify dashboard
4. Deploy automatically on each push

## User Flow

1. **Sign Up**: Create an account with email and password
2. **Import Leads**: Upload CSV files containing lead information
3. **View Dashboard**: See analytics about your lead database
4. **Search Leads**: Filter and search through all your leads
5. **Export Data**: Download filtered results as CSV
6. **Manage Duplicates**: Review and handle duplicate leads

## Column Mapping Examples

The system intelligently maps various column name formats:

```csv
First Name,Last Name,Email,Company,Title
John,Doe,john@example.com,Acme Inc,CEO
```

```csv
firstname,lastname,email address,organization,job title
Jane,Smith,jane@example.com,TechCorp,CTO
```

Both formats above will be correctly imported and mapped to the standard schema.

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Run `npm install` to ensure all dependencies are installed
- Clear the `.next` folder: `rm -rf .next`

### Import Failures
- Verify CSV has email column (required)
- Check for proper CSV formatting
- Ensure file encoding is UTF-8

### Authentication Issues
- Verify Supabase credentials in `.env.local`
- Check that email confirmation is disabled in Supabase Auth settings
- Clear browser cache and cookies

## Future Enhancements

Potential features for future development:
- Bulk lead enrichment APIs
- Advanced duplicate merging
- Lead scoring and tagging
- Email campaign integration
- API endpoints for external integrations
- Advanced analytics and reporting
- Team collaboration features

## License

This project is built for educational and commercial use.

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
