'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
// import demofile from '@/public/leadvault-example.csv';
import { mapCSVToLead, normalizeEmail, normalizeLinkedIn, normalizePhone } from '@/lib/csv-utils';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const dynamic = 'force-dynamic';

export default function ImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');
  const [result, setResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    duplicates: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      const workspace = localStorage.getItem('activeWorkspace') || user.id;
      setActiveWorkspace(workspace);
    }
  }, [user]);

  useEffect(() => {
    const handleWorkspaceChange = (e: any) => {
      if (user) {
        const workspace = e.detail?.workspaceId || localStorage.getItem('activeWorkspace') || user.id;
        setActiveWorkspace(workspace);
      }
    };
    window.addEventListener('workspaceChanged', handleWorkspaceChange);
    return () => window.removeEventListener('workspaceChanged', handleWorkspaceChange);
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!user) return;
    if (!file && !googleSheetUrl) {
      toast({ title: 'Error', description: 'Please choose a file or enter a Google Sheet URL', variant: 'destructive' });
      return;
    }

    const workspace = localStorage.getItem('activeWorkspace') || user.id;
    setActiveWorkspace(workspace);

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      let rows: any[] = [];

      if (googleSheetUrl && googleSheetUrl.trim()) {
        // fetch CSV via server-side proxy to avoid CORS issues
        const url = googleSheetUrl.trim();
        const proxyRes = await fetch('/api/fetch-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!proxyRes.ok) {
          const err = await proxyRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch Google Sheet');
        }
        const payload = await proxyRes.json();
        const text = payload.csv as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          toast({ title: 'Error', description: 'The Google Sheet appears empty', variant: 'destructive' });
          setImporting(false);
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, index) => row[header] = values[index] || '');
          rows.push(row);
        }
      } else if (file && file.name.toLowerCase().endsWith('.xlsx')) {
        // parse excel
        rows = await (await import('@/lib/csv-utils')).parseExcel(file);
      } else if (file) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          toast({
            title: 'Error',
            description: 'The file is empty',
            variant: 'destructive',
          });
          setImporting(false);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, index) => row[header] = values[index] || '');
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        toast({
          title: 'Error',
          description: 'The file is empty',
          variant: 'destructive',
        });
        setImporting(false);
        return;
      }

      const totalRows = rows.length;

      const { data: importRecord, error: importError } = await supabase
        .from('imports')
        .insert({
          file_name: file?.name || googleSheetUrl || 'import',
          total_rows: totalRows,
          successful_rows: 0,
          failed_rows: 0,
          status: 'processing',
          user_id: workspace,
        })
        .select()
        .single();

      if (importError) throw importError;

      let successful = 0;
      let failed = 0;
      let duplicates = 0;
      const batchSize = 100;

      // Preload existing leads for duplicate detection (email, name, phone, linkedin)
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, email, first_name, last_name, phone, linkedin_url')
        .eq('user_id', workspace);

      const existingEmails = new Set<string>((existingLeads || []).map(l => normalizeEmail((l as any).email || '')));
      const existingFirstNames = new Set<string>((existingLeads || []).map(l => ((l as any).first_name || '').trim().toLowerCase()));
      const existingLastNames = new Set<string>((existingLeads || []).map(l => ((l as any).last_name || '').trim().toLowerCase()));
      const existingFullNames = new Set<string>((existingLeads || []).map(l => (`${((l as any).first_name || '').trim()} ${((l as any).last_name || '').trim()}`).trim().toLowerCase()));
      const existingPhones = new Set<string>((existingLeads || []).map(l => normalizePhone((l as any).phone || '')));
      const existingLinkedIns = new Set<string>((existingLeads || []).map(l => normalizeLinkedIn((l as any).linkedin_url || '')));

      // Track inserts within this import to avoid duplicates in-file
      const insertedEmails = new Set<string>();
      const insertedFirstNames = new Set<string>();
      const insertedLastNames = new Set<string>();
      const insertedFullNames = new Set<string>();

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, Math.min(i + batchSize, rows.length));
        const leadsToInsert: any[] = [];

        // Track duplicates inside this batch before inserting to DB
        const batchEmails = new Set<string>();
        const batchFirstNames = new Set<string>();
        const batchLastNames = new Set<string>();
        const batchFullNames = new Set<string>();

        for (const row of batch) {
          const mapped = mapCSVToLead(row);

          if (!mapped.email || mapped.email === '') {
            failed++;
            continue;
          }

          const emailNorm = normalizeEmail(mapped.email || '');

          // Duplicate if email exists in DB or already inserted in this import
          if (existingEmails.has(emailNorm) || insertedEmails.has(emailNorm)) {
            duplicates++;
            failed++;
            continue;
          }

          // LinkedIn / phone duplicate checks
          const phoneNorm = normalizePhone(mapped.phone || '');
          const linkedNorm = normalizeLinkedIn(mapped.linkedin_url || '');
          if ((phoneNorm && (existingPhones.has(phoneNorm) || insertedEmails.has(phoneNorm))) || (linkedNorm && (existingLinkedIns.has(linkedNorm) || insertedEmails.has(linkedNorm)))) {
            duplicates++;
            failed++;
            continue;
          }

          // Normalize name tokens for flexible matching
          const firstNorm = (mapped.first_name || '').trim().toLowerCase();
          const lastNorm = (mapped.last_name || '').trim().toLowerCase();
          const fullNorm = [firstNorm, lastNorm].filter(Boolean).join(' ').trim();

          let isNameDuplicate = false;

          if (fullNorm) {
            if (existingFullNames.has(fullNorm) || insertedFullNames.has(fullNorm)) {
              isNameDuplicate = true;
            }
          }

          // If only a single name provided (first or last), allow match against either existing first or last names
          if (!isNameDuplicate) {
            if (firstNorm && !lastNorm) {
              if (existingFirstNames.has(firstNorm) || insertedFirstNames.has(firstNorm)) {
                isNameDuplicate = true;
              }
            } else if (lastNorm && !firstNorm) {
              if (existingLastNames.has(lastNorm) || insertedLastNames.has(lastNorm)) {
                isNameDuplicate = true;
              }
            }
          }

          if (isNameDuplicate) {
            duplicates++;
            failed++;
            continue;
          }

          // Prevent duplicates within the same batch (same email or name)
          if (batchEmails.has(emailNorm) || (fullNorm && batchFullNames.has(fullNorm)) || (firstNorm && batchFirstNames.has(firstNorm)) || (lastNorm && batchLastNames.has(lastNorm))) {
            duplicates++;
            failed++;
            continue;
          }

          // Reserve this row in batch sets to catch duplicates later in this batch
          batchEmails.add(emailNorm);
          if (firstNorm) batchFirstNames.add(firstNorm);
          if (lastNorm) batchLastNames.add(lastNorm);
          if (fullNorm) batchFullNames.add(fullNorm);

          leadsToInsert.push({
            ...mapped,
            source_file: file?.name || googleSheetUrl || null,
            import_id: importRecord.id,
            user_id: workspace,
          });
        }

        if (leadsToInsert.length > 0) {
          const { error } = await supabase.from('leads').insert(leadsToInsert);

          if (error) {
            failed += leadsToInsert.length;
          } else {
            successful += leadsToInsert.length;

            // mark inserted names/emails to prevent duplicates inside import
            for (const l of leadsToInsert) {
              const e = normalizeEmail((l as any).email || '');
              insertedEmails.add(e);
              const f = ((l as any).first_name || '').trim().toLowerCase();
              const r = ((l as any).last_name || '').trim().toLowerCase();
              const full = [f, r].filter(Boolean).join(' ').trim();
              if (f) insertedFirstNames.add(f);
              if (r) insertedLastNames.add(r);
              if (full) insertedFullNames.add(full);
            }
              // audit log for this batch
              try {
                await supabase.from('audit_logs').insert({
                  action: 'import_batch',
                  table_name: 'leads',
                  record_id: null,
                  actor_id: user!.id,
                  actor_email: user!.email,
                  workspace_id: workspace,
                  details: { count: leadsToInsert.length, import_id: importRecord.id }
                });
              } catch (e) {
                // ignore audit failures
              }
          }
        }

        setProgress(Math.round((i / totalRows) * 100));
      }

      await supabase
        .from('imports')
        .update({
          successful_rows: successful,
          failed_rows: failed,
          status: 'completed',
        })
        .eq('id', importRecord.id);

      setResult({
        total: totalRows,
        successful,
        failed,
        duplicates,
      });

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${successful} out of ${totalRows} leads`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import leads',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Import Leads</h1>
          <p className="text-slate-600 mt-1">Upload CSV files to add leads to your database</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <CardDescription>
                  Select a CSV file containing lead information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">CSV File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                  <div className="mt-2">
                    <Label htmlFor="gsheet">Or Google Sheets public URL</Label>
                    <Input id="gsheet" type="text" placeholder="https://docs.google.com/spreadsheets/.." value={googleSheetUrl} onChange={e => setGoogleSheetUrl(e.target.value)} />
                  </div>
                </div>

                {(file || googleSheetUrl) && !importing && !result && (
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center">
                      <FileSpreadsheet className="w-8 h-8 text-slate-600 mr-3" />
                      <div>
                        {file ? (
                          <>
                            <p className="font-medium text-slate-900">{file.name}</p>
                            <p className="text-sm text-slate-600">{(file.size / 1024).toFixed(2)} KB</p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-slate-900">Google Sheet</p>
                            <p className="text-sm text-slate-600 truncate" style={{maxWidth: 360}}>{googleSheetUrl}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <Button onClick={handleImport}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                )}

                {importing && (
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">Importing leads...</span>
                      <span className="text-sm text-slate-600">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center text-sm text-slate-600">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing CSV file and checking for duplicates
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                      <span className="font-medium text-green-900">Import Complete</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600">Total Rows:</span>
                        <span className="ml-2 font-medium text-slate-900">{result.total}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Successful:</span>
                        <span className="ml-2 font-medium text-green-600">{result.successful}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Failed:</span>
                        <span className="ml-2 font-medium text-red-600">{result.failed}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Duplicates:</span>
                        <span className="ml-2 font-medium text-amber-600">{result.duplicates}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => router.push('/dashboard/leads')}
                    >
                      View Leads
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  CSV Format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Supported Columns</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>First Name / FirstName</li>
                    <li>Last Name / LastName</li>
                    <li>Email (required)</li>
                    <li>Phone / Phone Number</li>
                    <li>LinkedIn / LinkedIn URL</li>
                    <li>Company</li>
                    <li>Title / Job Title</li>
                    <li>Website</li>
                    <li>Location</li>
                    <li>Notes</li>
                  </ul>
                </div>
                <div>
                  {/* <h4 className="font-medium text-slate-900 mb-2">Example CSV File</h4> */}
                  <a
                    href={"/leadvault-example.csv"}
                    download
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download Example CSV
                  </a>
                  {" "}
                  <br />
                  or
                  <br />
                  {" "}
                  <a
                    href={"https://docs.google.com/spreadsheets/d/1RRAU6bvlsLiNsgTKdxgemymOyn_9Bu-nIzQcIhmCtlg/edit?usp=sharing"}
                    target='_blank'
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Link className="w-4 h-4 mr-1" />
                    See Example Google Sheet
                  </a>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Important Notes</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>Email is required for each lead</li>
                    <li>Duplicates are automatically detected</li>
                    <li>Column names are case-insensitive</li>
                    <li>Empty values are allowed</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
