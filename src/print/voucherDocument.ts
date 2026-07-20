import { numberToArabicWords } from './arabicAmount'
import { buildClicheHeaderHtml, clicheHeaderCss } from './clicheHeader'
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from './printSettings'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('اسمح بالنوافذ المنبثقة للطباعة')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export type VoucherPrintKind = 'receipt' | 'payment' | 'credit_note'

export type VoucherPrintData = {
  kind: VoucherPrintKind
  number: string
  date: string
  partyLabel: string
  partyName: string
  accountLabel?: string
  accountValue?: string
  intro?: string
  amount: number
  currency: string
  description: string
  note?: string
}

const KIND_TITLE: Record<VoucherPrintKind, string> = {
  receipt: 'سند قبض',
  payment: 'سند صرف',
  credit_note: 'سند إشعار دائن',
}

const KIND_INTRO: Record<VoucherPrintKind, string> = {
  receipt: 'نود إشعاركم أننا استلمنا منكم حسب التفاصيل التالية',
  payment: 'نود إشعاركم أننا صرفنا لكم حسب التفاصيل التالية',
  credit_note: 'نود إشعاركم أننا قيدنا لحسابكم لدينا حسب التفاصيل التالية',
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatStamp() {
  return new Date().toLocaleString('ar-YE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

/** بناء HTML كليشة + سند بنسق الإشعار */
export function buildVoucherDocumentHtml(opts: {
  brandName: string
  logoUrl?: string | null
  phones?: string
  settings?: PrintSettings
  voucher: VoucherPrintData
}) {
  const s = opts.settings ?? DEFAULT_PRINT_SETTINGS
  const brandName = opts.brandName || 'أسطول المسافر'
  const logoUrl = opts.logoUrl || null
  const title = KIND_TITLE[opts.voucher.kind]
  const intro = opts.voucher.intro || KIND_INTRO[opts.voucher.kind]
  const amountWords = `${numberToArabicWords(opts.voucher.amount)} ${opts.voucher.currency} لا غير`
  const partyLabel = opts.voucher.partyLabel || 'العميل'
  const accountLabel = opts.voucher.accountLabel || 'رقم الحساب'
  const accountValue = opts.voucher.accountValue || '—'
  const cliche = buildClicheHeaderHtml({
    brandName,
    logoUrl,
    phones: opts.phones,
    settings: s,
  })

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} ${escapeHtml(opts.voucher.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
    }
    .sheet { max-width: 820px; margin: 0 auto; }
    ${clicheHeaderCss(s)}
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: center;
      margin: 14px 0 12px;
    }
    .meta-box, .title-box {
      border: 1.5px solid ${s.frameColor};
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      min-height: 40px;
      display: grid;
      place-items: center;
    }
    .title-box {
      background: ${s.titleBgColor};
      color: ${s.titleTextColor};
      border-color: ${s.titleBgColor};
      min-width: 180px;
      font-size: 16px;
      padding: 10px 22px;
    }
    .grid {
      border: 1.5px solid ${s.frameColor};
      border-radius: 4px;
      overflow: hidden;
    }
    .row {
      display: grid;
      border-bottom: 1px solid ${s.frameColor};
      min-height: 38px;
    }
    .row:last-child { border-bottom: none; }
    .row-2 { grid-template-columns: 1fr 1fr; }
    .row-1 { grid-template-columns: 1fr; }
    .cell {
      padding: 8px 12px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .row-2 .cell + .cell { border-inline-start: 1px solid ${s.frameColor}; }
    .label { color: #555; font-weight: 700; white-space: nowrap; }
    .value { font-weight: 700; color: #111; }
    .center { justify-content: center; text-align: center; }
    .head-cell {
      background: #f3f5f8;
      font-weight: 800;
      justify-content: center;
    }
    .desc-head {
      background: #eef2f7;
      font-weight: 800;
      justify-content: center;
      min-height: 34px;
    }
    .desc-body { min-height: 56px; align-items: flex-start; }
    .note { color: #b91c1c; font-weight: 700; }
    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
      color: #444;
    }
    .footer .line {
      border-top: 1px solid #bbb;
      width: 70%;
      margin: 0 auto 8px;
      position: relative;
    }
    .footer .stamp {
      margin-top: 10px;
      font-size: 11px;
      color: #666;
      text-align: left;
      direction: ltr;
    }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${cliche}

    <div class="title-row">
      <div class="meta-box">الرقم: ${escapeHtml(opts.voucher.number || '—')}</div>
      <div class="title-box">${escapeHtml(title)}</div>
      <div class="meta-box">التاريخ: ${escapeHtml(opts.voucher.date || '—')}</div>
    </div>

    <div class="grid">
      <div class="row row-2">
        <div class="cell">
          <span class="label">${escapeHtml(partyLabel)}:</span>
          <span class="value">${escapeHtml(opts.voucher.partyName || '—')}</span>
        </div>
        <div class="cell">
          <span class="label">${escapeHtml(accountLabel)}:</span>
          <span class="value">${escapeHtml(accountValue)}</span>
        </div>
      </div>
      <div class="row row-1">
        <div class="cell center">${escapeHtml(intro)}</div>
      </div>
      <div class="row row-2">
        <div class="cell head-cell">مبلغ الحساب</div>
        <div class="cell head-cell">عملة الحساب</div>
      </div>
      <div class="row row-2">
        <div class="cell center value">${escapeHtml(formatMoney(opts.voucher.amount))}</div>
        <div class="cell center value">${escapeHtml(opts.voucher.currency || '—')}</div>
      </div>
      <div class="row row-1">
        <div class="cell center value">${escapeHtml(amountWords)}</div>
      </div>
      <div class="row row-1">
        <div class="cell desc-head">البيان</div>
      </div>
      <div class="row row-1">
        <div class="cell desc-body">${escapeHtml(opts.voucher.description || '—')}</div>
      </div>
      <div class="row row-1">
        <div class="cell note">ملاحظة: ${escapeHtml(opts.voucher.note || '')}</div>
      </div>
    </div>

    <div class="footer">
      <div class="line"></div>
      <div>${escapeHtml(s.footerNote)}</div>
      <div class="stamp">${escapeHtml(formatStamp())}</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

export function printVoucherDocument(opts: {
  brandName: string
  logoUrl?: string | null
  phones?: string
  settings?: PrintSettings
  voucher: VoucherPrintData
}) {
  openPrintWindow(buildVoucherDocumentHtml(opts))
}

/** معاينة داخل الصفحة (بدون نافذة طباعة) */
export function voucherPreviewHtml(opts: Parameters<typeof buildVoucherDocumentHtml>[0]) {
  return buildVoucherDocumentHtml(opts).replace(
    /<script>window\.onload = \(\) => \{ window\.print\(\); \}<\/script>/,
    '',
  )
}
