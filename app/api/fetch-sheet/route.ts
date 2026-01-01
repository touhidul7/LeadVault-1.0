import { NextResponse } from 'next/server';

type ReqBody = {
  url?: string;
};

export async function POST(req: Request) {
  try {
    const body: ReqBody = await req.json();
    if (!body?.url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    let url = body.url.trim();

    // Convert common Google Sheets share/edit URLs to CSV export URL
    if (url.includes('/edit')) {
      url = url.replace(/\/edit.*$/, '/export?format=csv');
    }

    // If still not an export URL but contains /d/<id>/, build an export URL
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && !/export\?format=csv/.test(url)) {
      const id = match[1];
      url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch sheet: ${res.status} ${res.statusText}` }, { status: 502 });
    }

    const csv = await res.text();
    return NextResponse.json({ csv });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
