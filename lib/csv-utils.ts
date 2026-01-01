export function normalizeEmail(email: string): string {
  return email?.trim().toLowerCase() || '';
}

export function normalizePhone(phone: string): string {
  return phone?.replace(/\D/g, '') || '';
}

export function normalizeLinkedIn(url: string): string {
  if (!url) return '';

  url = url.trim();

  if (url.includes('linkedin.com/in/')) {
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? `https://linkedin.com/in/${match[1]}` : url;
  }

  return url;
}

export function parseCSV(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}

export function mapCSVToLead(row: any): Partial<any> {
  const headerMap: Record<string, string> = {
    'first name': 'first_name',
    'firstname': 'first_name',
    'fname': 'first_name',
    'last name': 'last_name',
    'lastname': 'last_name',
    'lname': 'last_name',
      'name': 'full_name',
      'full name': 'full_name',
      'fullname': 'full_name',
    'email': 'email',
    'email address': 'email',
    'phone': 'phone',
    'phone number': 'phone',
    'mobile': 'phone',
    'linkedin': 'linkedin_url',
    'linkedin url': 'linkedin_url',
    'linkedin_url': 'linkedin_url',
    'company': 'company',
    'company name': 'company',
    'organization': 'company',
    'title': 'title',
    'job title': 'title',
    'position': 'title',
    'website': 'website',
    'company website': 'website',
    'location': 'location',
    'city': 'location',
    'country': 'country',
    'notes': 'notes',
    'description': 'notes',
  };

  const mapped: any = {};

  Object.keys(row).forEach(key => {
    const normalizedKey = key.toLowerCase().trim();
    const mappedKey = headerMap[normalizedKey] || normalizedKey;

    if (row[key]) {
      mapped[mappedKey] = row[key];
    }
  });

  // If a full name was provided but no explicit first/last, attempt to split.
  let first = mapped.first_name || '';
  let last = mapped.last_name || '';

  if ((!first || !last) && mapped.full_name) {
    const parts = (mapped.full_name || '').trim().split(/\s+/);
    if (parts.length === 1) {
      first = parts[0];
      last = '';
    } else if (parts.length > 1) {
      first = parts.slice(0, -1).join(' ');
      last = parts[parts.length - 1];
    }
  }

  return {
    first_name: first || '',
    last_name: last || '',
    email: normalizeEmail(mapped.email || ''),
    phone: normalizePhone(mapped.phone || ''),
    linkedin_url: normalizeLinkedIn(mapped.linkedin_url || ''),
    company: mapped.company || '',
    title: mapped.title || '',
    website: mapped.website || '',
    location: mapped.location || '',
    country: mapped.country || '',
    notes: mapped.notes || '',
  };
}

export function exportToCSV(leads: any[], filename: string = 'leads.csv') {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'LinkedIn',
    'Company',
    'Title',
    'Website',
    'Location',
    'Country',
    'Notes',
    'Source File',
    'Created At',
  ];

  const rows = leads.map(lead => [
    lead.first_name,
    lead.last_name,
    lead.email,
    lead.phone,
    lead.linkedin_url,
    lead.company,
    lead.title,
    lead.website,
    lead.location,
    lead.country,
    lead.notes,
    lead.source_file,
    lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseExcel(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();

  // Prefer exceljs (safer alternative). If not installed, fall back to xlsx.
  try {
    // @ts-ignore
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    // exceljs accepts ArrayBuffer for xlsx
    await workbook.xlsx.load(arrayBuffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const result: any[] = [];
    const headerRow = worksheet.getRow(1).values as any[];
    const headers = headerRow.slice(1).map((h: any) => (h ?? '').toString().trim());

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values = row.values as any[];
      const rowObj: any = {};
      for (let i = 1; i <= headers.length; i++) {
        rowObj[headers[i - 1]] = values[i] ?? '';
      }
      result.push(rowObj);
    });

    return result;
  } catch (e) {
    // exceljs is required for Excel parsing
    console.error('Failed to parse Excel file:', e);
    throw new Error('Unable to parse Excel file: exceljs is required');
  }
}
export async function exportToExcel(leads: any[], filename: string = 'leads.xlsx') {
  // Prefer exceljs if available
  try {
    // @ts-ignore
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'LinkedIn',
      'Company',
      'Title',
      'Website',
      'Location',
      'Notes',
      'Source File',
      'Created At',
    ];

    worksheet.addRow(headers);
    for (const l of leads) {
      worksheet.addRow([
        l.first_name,
        l.last_name,
        l.email,
        l.phone,
        l.linkedin_url,
        l.company,
        l.title,
        l.website,
        l.location,
        l.notes,
        l.source_file,
        l.created_at,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    // file-saver bundles can export differently depending on bundler; handle defaults
    try {
      const mod = await import('file-saver');
      const saveCandidate: any = mod && (mod.saveAs || mod.default || mod);
      if (typeof saveCandidate === 'function') {
        saveCandidate(blob, filename);
        return;
      }
    } catch (e) {
      // fallthrough to anchor-download fallback
    }

    // Fallback: create an object URL and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    // exceljs is required for Excel export
    console.error('Failed to export Excel file:', e);
    throw new Error('Unable to export Excel file: exceljs is required');
  }
}

export function exportToJSON(leads: any[], filename: string = 'leads.json') {
  const json = JSON.stringify(leads, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPDF(leads: any[], filename: string = 'leads.pdf') {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const margin = 12;
    const lineHeight = 8;
    const maxWidth = 190; // approx A4 usable width
    const headers = ['First', 'Last', 'Email', 'Phone', 'Company'];
    const rows = leads.map(l => [l.first_name || '', l.last_name || '', l.email || '', l.phone || '', l.company || '']);

    let y = margin;
    doc.setFontSize(12);
    doc.text(headers.join(' | '), margin, y);
    y += lineHeight;
    doc.setFontSize(10);

    for (const row of rows) {
      const line = row.map(c => (c || '').toString()).join(' | ');
      // simple wrapping if line too long
      const chunks = [] as string[];
      let current = '';
      for (const part of line.split(' ')) {
        if ((current + ' ' + part).length * 4 < maxWidth) {
          current = current ? current + ' ' + part : part;
        } else {
          chunks.push(current);
          current = part;
        }
      }
      if (current) chunks.push(current);

      for (const chunk of chunks) {
        if (y > 280) { doc.addPage(); y = margin; }
        doc.text(chunk, margin, y);
        y += lineHeight;
      }
      y += 2;
    }

    doc.save(filename);
  } catch (e) {
    // If PDF generation fails, fallback to JSON download so user still gets data
    exportToJSON(leads, filename.replace('.pdf', '.json'));
  }
}
