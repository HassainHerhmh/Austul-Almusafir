import * as XLSX from 'xlsx'

export function downloadExcel(filename: string, rows: Record<string, string | number>[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  // اتجاه الورقة من اليمين لليسار (عربي)
  ws['!views'] = [{ rightToLeft: true }]
  const wb = XLSX.utils.book_new()
  wb.Workbook = wb.Workbook || {}
  wb.Workbook.Views = [{ RTL: true }]
  XLSX.utils.book_append_sheet(wb, ws, 'بيانات')
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export type TripMetaRow = {
  driver: string
  assistant: string
  busNumber: string
  plateNumber: string
  /** اختياري عند وجود أكثر من رحلة */
  route?: string
}

/** تصدير Excel بكليشة + جدول السائق/المعاون/الباص ثم جدول البيانات */
export function downloadExcelReport(opts: {
  filename: string
  title: string
  companyName?: string
  phones?: string
  tripMeta?: TripMetaRow[]
  headers: string[]
  rows: (string | number)[][]
}) {
  const {
    filename,
    title,
    companyName = '',
    phones = '',
    tripMeta = [],
    headers,
    rows,
  } = opts

  const phoneLine = phones
    .split(/[\n,،]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' · ')

  const colCount = Math.max(headers.length, 4, 1)
  const aoa: (string | number)[][] = []

  // كليشة
  if (companyName) {
    aoa.push([companyName, ...Array(Math.max(0, colCount - 1)).fill('')])
  }
  if (phoneLine) {
    aoa.push([phoneLine, ...Array(Math.max(0, colCount - 1)).fill('')])
  }
  aoa.push([title, ...Array(Math.max(0, colCount - 1)).fill('')])
  aoa.push([])

  // جدول السائق / المعاون / الباص / اللوحة
  const multiTrip = tripMeta.length > 1
  if (tripMeta.length > 0) {
    const metaHeaders = multiTrip
      ? ['الرحلة', 'السائق', 'المعاون', 'رقم الباص', 'اللوحة']
      : ['السائق', 'المعاون', 'رقم الباص', 'اللوحة']
    aoa.push(metaHeaders)
    for (const m of tripMeta) {
      aoa.push(
        multiTrip
          ? [
              m.route || '—',
              m.driver || '—',
              m.assistant || '—',
              m.busNumber || '—',
              m.plateNumber || '—',
            ]
          : [m.driver || '—', m.assistant || '—', m.busNumber || '—', m.plateNumber || '—'],
      )
    }
    aoa.push([])
  }

  // جدول الحجوزات
  aoa.push(headers)
  for (const row of rows) {
    aoa.push(row.map((c) => (c == null ? '' : c)))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!views'] = [{ rightToLeft: true }]

  const merges: XLSX.Range[] = []
  let r = 0
  if (companyName) {
    merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } })
    r += 1
  }
  if (phoneLine) {
    merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } })
    r += 1
  }
  merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } })
  if (merges.length) ws['!merges'] = merges

  ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 16 }))

  const wb = XLSX.utils.book_new()
  wb.Workbook = wb.Workbook || {}
  wb.Workbook.Views = [{ RTL: true }]
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
  tripMeta?: TripMetaRow[]
}) {
  const {
    title,
    headers,
    rows,
    companyName = '',
    logoUrl = null,
    phones = '',
    tripMeta = [],
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

  const multiTrip = tripMeta.length > 1
  const metaTable =
    tripMeta.length > 0
      ? `<table class="meta-table">
    <thead><tr>${
      multiTrip
        ? '<th>الرحلة</th><th>السائق</th><th>المعاون</th><th>رقم الباص</th><th>اللوحة</th>'
        : '<th>السائق</th><th>المعاون</th><th>رقم الباص</th><th>اللوحة</th>'
    }</tr></thead>
    <tbody>
      ${tripMeta
        .map((m) =>
          multiTrip
            ? `<tr>
                <td>${escapeHtml(m.route || '—')}</td>
                <td>${escapeHtml(m.driver || '—')}</td>
                <td>${escapeHtml(m.assistant || '—')}</td>
                <td>${escapeHtml(m.busNumber || '—')}</td>
                <td>${escapeHtml(m.plateNumber || '—')}</td>
              </tr>`
            : `<tr>
                <td>${escapeHtml(m.driver || '—')}</td>
                <td>${escapeHtml(m.assistant || '—')}</td>
                <td>${escapeHtml(m.busNumber || '—')}</td>
                <td>${escapeHtml(m.plateNumber || '—')}</td>
              </tr>`,
        )
        .join('')}
    </tbody>
  </table>`
      : ''

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
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }
    th, td { border: 1px solid #ccc; padding: 7px 8px; text-align: right; }
    th { background: #f3f4f6; font-weight: 700; }
    .meta-table th { background: #e8eef5; }
    @media print {
      body { padding: 0; }
      .cliche { break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${cliche}
  ${metaTable}
  <h1>${escapeHtml(title)}</h1>
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
