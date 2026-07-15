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
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; }
    th { background: #f3f4f6; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
  const win = window.open('', '_blank')
  if (!win) {
    alert('اسمح بالنوافذ المنبثقة لتصدير PDF')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
