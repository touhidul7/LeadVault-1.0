# LeadVault Deployment Guide

This guide covers deploying LeadVault to production using Netlify, Vercel, or other platforms.

## What Was Fixed

The build errors were caused by Next.js attempting to statically generate pages during build time when the Supabase environment variables contained placeholder values.

**Solution Applied:**
- Added `export const dynamic = 'force-dynamic'` to all pages that use Supabase
- This tells Next.js to skip static generation for these pages and render them on-demand

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] A Supabase project created
- [ ] Supabase URL and anon key (from Settings → API)
- [ ] A GitHub repository with the code pushed
- [ ] A deployment platform account (Netlify or Vercel)
- [ ] Email confirmation disabled in Supabase (for development/testing)

## Deployment Options

### Option 1: Netlify (Recommended)

**Benefits:**
- Pre-configured with `netlify.toml`
- Automatic deployments from Git
- Free tier available
- Built-in form handling

#### Steps:

1. **Connect Repository**
   - Go to https://netlify.com
   - Click "New site from Git"
   - Connect your GitHub account
   - Select your LeadVault repository

2. **Configure Build Settings**
   - Build command: `npm run build` (already set in netlify.toml)
   - Publish directory: `.next` (already set in netlify.toml)
   - No additional configuration needed

3. **Add Environment Variables**
   - In Netlify dashboard, go to:
     - Site settings → Build & deploy → Environment
   - Click "Edit variables"
   - Add two variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key_here
     ```

4. **Deploy**
   - Click "Deploy site"
   - Netlify will automatically:
     - Clone your repository
     - Run `npm install`
     - Run `npm run build`
     - Deploy to production
   - Your site will be live at `your-site.netlify.app`

5. **Enable HTTPS**
   - Netlify automatically provides free HTTPS
   - Check Site settings → Domain management for custom domains

#### Continuous Deployment
- Every push to main branch automatically deploys
- Preview deploys for pull requests (enable in settings)

### Option 2: Vercel

**Benefits:**
- Official Next.js hosting
- Optimized for Next.js
- Excellent performance

#### Steps:

1. **Connect Repository**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository

2. **Configure**
   - Framework preset: Next.js (auto-detected)
   - Root directory: ./ (default)
   - Build command: `npm run build` (auto-detected)
   - Environment: Next.js

3. **Add Environment Variables**
   - In the "Environment Variables" section, add:
     ```
     NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key_here
     ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Your site will be live at `your-site.vercel.app`

### Option 3: Self-Hosted

#### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=your_url \
             --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
             -t leadVault .
docker run -p 3000:3000 leadVault
```

#### Using Railway, Render, or Heroku

These platforms follow similar patterns:

1. Connect your GitHub repository
2. Set environment variables in platform dashboard
3. Platform automatically detects Next.js and deploys
4. Builds run on `npm run build`

## Post-Deployment

### Verify Deployment

1. **Test Authentication**
   - Navigate to your deployed URL
   - Sign up for a new account
   - Verify email/password authentication works

2. **Test Import**
   - Upload the sample-leads.csv file
   - Verify import completes successfully

3. **Test Leads Table**
   - Verify leads display correctly
   - Test search and filter functionality
   - Test export functionality

4. **Test Export**
   - Export some leads
   - Verify CSV file downloads

### Enable Production Security

1. **Supabase Email Confirmation**
   - In Supabase dashboard, go to Authentication → Settings
   - Toggle ON "Enable email confirmations"
   - This ensures only verified emails can sign up

2. **Custom Domain**
   - Both Netlify and Vercel support custom domains
   - Follow their documentation to add your domain

3. **Monitoring**
   - Set up error tracking (Sentry, Rollbar)
   - Monitor Supabase dashboard for usage
   - Set up alerts for high database usage

## Environment Variables Reference

### Required Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Important Notes

- These are "NEXT_PUBLIC_" variables, meaning they're exposed in the client bundle
- They use the anon (public) key, not the service role key
- The anon key has restricted permissions via RLS policies
- Keep your Supabase credentials secure in deployment platforms

## Troubleshooting Deployment

### Issue: Build Fails

**Check:**
1. All environment variables are set correctly
2. No TypeScript errors: Run `npm run typecheck` locally
3. All required files are committed to Git
4. Node version is 18+

**Fix:**
1. Check deployment logs in platform dashboard
2. Run `npm run build` locally to reproduce
3. Fix errors and push new commit

### Issue: Pages Don't Load / 404 Errors

**Check:**
1. Deployment completed successfully (check deploy logs)
2. Environment variables are set correctly
3. Supabase project is active (check in Supabase dashboard)

**Fix:**
1. Clear browser cache
2. Check browser console for errors
3. Verify Supabase URL and key are correct

### Issue: Authentication Not Working

**Check:**
1. Supabase URL and anon key are correct
2. Email confirmation is appropriate for your needs
3. Supabase Auth provider is enabled

**Fix:**
1. Test locally with same environment variables
2. Verify Supabase project settings
3. Check Supabase auth logs

### Issue: Database Connection Errors

**Check:**
1. Supabase project is active (not paused)
2. Database tables exist and have RLS policies
3. Credentials have proper permissions

**Fix:**
1. Check Supabase dashboard for project status
2. Verify migrations ran successfully
3. Check RLS policies are correctly configured

## Scaling Considerations

### Database

- **Supabase Free Tier**: Up to 500 MB storage, suitable for up to ~100k leads
- **Paid Plans**: Unlimited storage, better for large datasets

### Storage & Bandwidth

- Netlify: 100 GB bandwidth/month on free tier
- Vercel: Similar limits, generous for production use
- Both offer unlimited on paid plans

### Performance Optimization

For large datasets (100k+ leads):

1. **Add Pagination**
   - Modify leads table to paginate results
   - Load 50-100 leads per page

2. **Add Caching**
   - Use Next.js ISR or revalidate
   - Cache common searches

3. **Database Optimization**
   - Add more indexes on frequently searched columns
   - Consider partitioning by company or date

4. **CDN**
   - Both Netlify and Vercel include CDN
   - Static assets are cached globally

## Monitoring & Analytics

### Supabase Dashboard
- Check database usage
- Monitor API request counts
- View authentication logs
- Track real-time active users

### Platform Monitoring
- **Netlify**: Analytics in deployment dashboard
- **Vercel**: Analytics and Web Vitals dashboard
- Monitor response times and error rates

### Recommended Services
- **Error Tracking**: Sentry, Rollbar, or Bugsnag
- **Monitoring**: Datadog, New Relic, or Grafana
- **Analytics**: Vercel Analytics, LogRocket, or Mixpanel

## Updating in Production

### Process
1. Make changes locally
2. Test thoroughly
3. Push to GitHub
4. Platform automatically deploys
5. Verify changes in production

### Database Migrations
1. Create new migration file
2. Apply via Supabase dashboard or CLI
3. Push code to trigger redeploy

## Backup Strategy

### Supabase Backups
- **Free tier**: Daily backups (7-day retention)
- **Paid tiers**: Hourly backups, longer retention
- Enable in Supabase settings

### Manual Exports
Periodically export leads data:

```bash
# Export via dashboard or:
# Use the export feature in your LeadVault app
```

## Cost Estimates

### Supabase
- **Free**: Up to 500 MB storage
- **Pro**: $25/month per project
- **Custom**: Contact sales for large deployments

### Netlify
- **Free**: Sufficient for most users
- **Pro**: $19/month (extra features)
- **Enterprise**: Custom pricing

### Vercel
- **Hobby**: Free tier
- **Pro**: $20/month per team member
- **Enterprise**: Custom pricing

## Support & Resources

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Netlify Docs: https://docs.netlify.com
- Vercel Docs: https://vercel.com/docs

---

**Congratulations!** Your LeadVault application is now live in production!
