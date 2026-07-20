import type { PrintSettings } from './printSettings'
import { DEFAULT_PRINT_SETTINGS } from './printSettings'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitLines(text: string): string[] {
  return text
    .split(/[\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * كليشة رقم 2 — لوحة ذهبية بحافة منحنية نحو الشعار (مثل المرجع)،
 * والذهب عبر SVG مستطيل + border-radius حتى يطبع بدون «رسومات الخلفية».
 */
export function clicheHeaderCss(s: PrintSettings = DEFAULT_PRINT_SETTINGS) {
  const gold = s.accentColor
  const ink = s.primaryColor
  return `
    .cliche-v2 {
      position: relative;
      margin: 0 0 10px;
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
      --cliche-gold: ${gold};
      --cliche-ink: ${ink};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .cliche-row {
      display: grid;
      /* يمين: هوية | وسط: شعار | يسار: عنوان وهواتف */
      grid-template-columns: minmax(0, 1.35fr) 100px minmax(0, 1.55fr);
      align-items: stretch;
      gap: 0;
      min-height: 100px;
    }
    .cliche-right {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      z-index: 2;
      padding-inline-end: 4px;
    }
    .cliche-identity {
      text-align: right;
      padding: 2px 4px 8px;
    }
    .cliche-identity .ar-name {
      font-size: 15px;
      font-weight: 800;
      color: var(--cliche-ink);
      line-height: 1.3;
      margin: 0;
    }
    .cliche-identity .en-name {
      font-size: 11px;
      font-weight: 700;
      color: var(--cliche-gold);
      margin-top: 2px;
    }
    .cliche-identity .slogan {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--cliche-gold);
      margin-top: 2px;
    }
    /* شريط الإدارة — حافة دائرية نحو الشعار (يسار الشريط) */
    .cliche-bar-mgmt {
      position: relative;
      color: var(--cliche-ink);
      padding: 7px 14px 7px 22px;
      font-size: 11px;
      font-weight: 800;
      text-align: right;
      direction: rtl;
      min-height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      z-index: 2;
      overflow: hidden;
      border-radius: 36px 0 0 0;
    }
    .cliche-bar-mgmt .gold-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      display: block;
    }
    .cliche-bar-mgmt .bar-text {
      position: relative;
      z-index: 1;
    }
    /* الشعار فاصل أبيض نظيف — بدون تداخل فوق الذهب */
    .cliche-center {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      position: relative;
      z-index: 3;
      background: #fff;
      padding: 0 2px;
    }
    .cliche-center .logo-wrap {
      width: 100%;
      max-width: 96px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 2px;
    }
    .cliche-center img {
      width: 100%;
      max-width: 96px;
      height: auto;
      max-height: 96px;
      object-fit: contain;
      display: block;
    }
    .cliche-center .logo-fallback {
      width: 72px;
      height: 72px;
      border-radius: 12px;
      background: #2a2a2a;
      color: var(--cliche-gold);
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 800;
    }
    /*
     * اللوحة اليسرى (عنوان + هواتف):
     * يسار الصفحة = زوايا مستديرة عادية
     * نحو الشعار (يمين اللوحة) = انحناء كبير مثل المرجع
     */
    .cliche-panel {
      position: relative;
      color: var(--cliche-ink);
      box-sizing: border-box;
      padding: 10px 14px 10px 12px;
      min-height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      z-index: 2;
      overflow: hidden;
      /* top-left | top-right(نحو الشعار) | bottom-right | bottom-left */
      border-radius: 14px 72px 14px 14px;
    }
    .cliche-panel .gold-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      display: block;
    }
    .cliche-panel .panel-inner {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cliche-panel .addr {
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: flex-start;
      gap: 4px;
      line-height: 1.35;
    }
    .cliche-panel .pill {
      border: 1.5px solid #fff;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 10.5px;
      font-weight: 700;
      color: var(--cliche-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      align-self: flex-start;
      max-width: 100%;
    }
    /* خط ذهبي رفيع تحت الكليشة يربط الطرفين مثل المرجع */
    .cliche-baseline {
      height: 2.5px;
      margin-top: 0;
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }
    .cliche-baseline .gold-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    @media print {
      .cliche-v2, .cliche-panel, .cliche-bar-mgmt, .cliche-baseline, .gold-svg {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  `
}

/** HTML كليشة — مستطيل SVG + قصّ بالـ border-radius (شكل نظيف يطبع) */
export function buildClicheHeaderHtml(opts: {
  brandName: string
  logoUrl?: string | null
  phones?: string
  settings?: PrintSettings
}) {
  const s = opts.settings ?? DEFAULT_PRINT_SETTINGS
  const brandName = opts.brandName || 'أسطول المسافر'
  const logoUrl = s.printLogoUrl || opts.logoUrl || null
  const brandPhoneLines = splitLines(
    (opts.phones || '').replace(/,/g, '\n').replace(/،/g, '\n'),
  )
  const brandPhonesJoined = brandPhoneLines.join(' - ')
  const gold = s.accentColor

  const mgmt = s.managementPhones || brandPhonesJoined
  const address = s.address || ''
  const serviceLines = splitLines(s.servicePhones || '')

  let pills: string[] = []
  if (serviceLines.length > 0) {
    pills = serviceLines.map((line) =>
      line.includes(':') || /خدمة/.test(line) ? line : `خدمة العملاء : ${line}`,
    )
  } else if (brandPhoneLines.length > 0) {
    pills = [`خدمة العملاء : ${brandPhonesJoined}`]
  }

  const pillHtml = pills
    .map((line) => `<div class="pill">${escapeHtml(line)}</div>`)
    .join('')

  /** مستطيل كامل — الشكل من CSS border-radius + overflow */
  const solidGoldSvg = `<svg class="gold-svg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" aria-hidden="true">
    <rect width="10" height="10" fill="${escapeHtml(gold)}"/>
  </svg>`

  return `
  <div class="cliche-v2">
    <div class="cliche-row">
      <div class="cliche-right">
        <div class="cliche-identity">
          <div class="ar-name">${escapeHtml(brandName)}</div>
          ${s.nameEn ? `<div class="en-name">${escapeHtml(s.nameEn)}</div>` : ''}
          ${s.slogan ? `<div class="slogan">${escapeHtml(s.slogan)}</div>` : ''}
        </div>
        <div class="cliche-bar-mgmt">
          ${solidGoldSvg}
          <span class="bar-text">${mgmt ? `الإدارة : ${escapeHtml(mgmt)}` : '&nbsp;'}</span>
        </div>
      </div>
      <div class="cliche-center">
        <div class="logo-wrap">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="" />`
              : `<div class="logo-fallback">أس</div>`
          }
        </div>
      </div>
      <div class="cliche-panel">
        ${solidGoldSvg}
        <div class="panel-inner">
          ${
            address
              ? `<div class="addr"><span aria-hidden="true">📍</span><span>${escapeHtml(address)}</span></div>`
              : ''
          }
          ${
            pillHtml ||
            `<div class="pill">خدمة العملاء : ${escapeHtml(brandPhonesJoined || '—')}</div>`
          }
        </div>
      </div>
    </div>
    <div class="cliche-baseline">${solidGoldSvg}</div>
  </div>`
}
