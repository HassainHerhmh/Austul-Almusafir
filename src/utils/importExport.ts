import * as XLSX from 'xlsx'

export function downloadExcel(filename: string, rows: Record<string, string | number>[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'بيانات')
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export async function readExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

function cell(v: unknown) {
  return String(v ?? '').trim()
}

function normHeader(s: string) {
  return s.replace(/[\s_\-–—/\\|]+/g, '').toLowerCase()
}

/** يطابق مفاتيح الأعمدة العربية أو الإنجليزية (دقيق أو يحتوي على المفتاح) */
export function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return cell(row[key])
    }
  }
  const entries = Object.entries(row).map(([k, v]) => [normHeader(k), v] as const)
  for (const key of keys) {
    const nk = normHeader(key)
    for (const [hk, v] of entries) {
      if (!hk || v === undefined || v === null || String(v).trim() === '') continue
      if (hk === nk || hk.includes(nk) || nk.includes(hk)) return cell(v)
    }
  }
  return ''
}

export function exportTablePdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  printTableReport({ title, headers, rows })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** طباعة جدول مع كليشة (شعار + اسم الشركة + أرقام التواصل) */
export function printTableReport(opts: {
  title: string
  headers: string[]
  rows: (string | number)[][]
  companyName?: string
  logoUrl?: string | null
  phones?: string
}) {
  const {
    title,
    headers,
    rows,
    companyName = '',
    logoUrl = null,
    phones = '',
  } = opts

  const phoneLines = phones
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const cliche = `
    <div class="cliche">
      ${
        logoUrl
          ? `<img class="logo" src="${logoUrl}" alt="" />`
          : `<div class="logo-fallback">🚌</div>`
      }
      <div class="cliche-text">
        ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ''}
        ${
          phoneLines.length
            ? `<div class="phones">${phoneLines.map(escapeHtml).join(' · ')}</div>`
            : ''
        }
      </div>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #111; margin: 0; }
    .cliche {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    .logo-fallback {
      width: 72px; height: 72px; display: grid; place-items: center;
      font-size: 36px; background: #f3f4f6; border-radius: 12px;
    }
    .company { font-size: 22px; font-weight: 700; color: #0c1a24; }
    .phones { margin-top: 6px; font-size: 13px; color: #444; direction: ltr; text-align: right; }
    h1 { font-size: 16px; margin: 0 0 12px; color: #333; }
    .meta { font-size: 12px; color: #666; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 7px 8px; text-align: right; }
    th { background: #f3f4f6; font-weight: 700; }
    @media print {
      body { padding: 0; }
      .cliche { break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${cliche}
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">تاريخ الطباعة: ${new Date().toLocaleString('ar-YE')}</div>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('اسمح بالنوافذ المنبثقة للطباعة')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

