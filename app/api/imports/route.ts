import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const sb = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leads, file_name, workspace_id } = body;
    if (!Array.isArray(leads)) return NextResponse.json({ error: 'leads must be array' }, { status: 400 });

    const { data: importRecord, error: impErr } = await sb
      .from('imports')
      .insert({ file_name: file_name || 'api-import', total_rows: leads.length, successful_rows: 0, failed_rows: 0, status: 'processing', user_id: workspace_id })
      .select()
      .single();

    if (impErr) throw impErr;

    const toInsert = leads.map((l: any) => ({ ...l, import_id: importRecord.id, source_file: file_name || 'api-import', user_id: workspace_id }));
    const { error: insErr } = await sb.from('leads').insert(toInsert);
    if (insErr) throw insErr;

    // create audit log
    await sb.from('audit_logs').insert({ action: 'import', table_name: 'leads', record_id: null, actor_id: null, actor_email: null, workspace_id, details: { count: leads.length } });

    return NextResponse.json({ ok: true, imported: leads.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
