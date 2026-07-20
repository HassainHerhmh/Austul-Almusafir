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
 * كليشة رقم 2 — ألوان ذهبية عبر SVG لتظهر حتى لو أُلغيت «رسومات الخلفية» في الطباعة.
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
      grid-template-columns: minmax(0, 1.28fr) 78px minmax(0, 1.55fr);
      align-items: stretch;
      gap: 0;
      min-height: 96px;
    }
    .cliche-right {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      z-index: 2;
    }
    .cliche-identity {
      text-align: right;
      padding: 2px 4px 6px;
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
    .cliche-bar-mgmt {
      position: relative;
      color: var(--cliche-ink);
      margin-left: -22px;
      padding: 7px 12px 7px 28px;
      font-size: 11px;
      font-weight: 800;
      text-align: right;
      direction: rtl;
      min-height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: calc(100% + 22px);
      box-sizing: border-box;
      z-index: 2;
      overflow: hidden;
      border-radius: 40px 0 0 0;
    }
    .cliche-bar-mgmt .gold-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }
    .cliche-bar-mgmt .bar-text {
      position: relative;
      z-index: 1;
    }
    .cliche-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      position: relative;
      z-index: 5;
      background: transparent;
      padding: 0;
    }
    .cliche-center .logo-cradle {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      flex: 1;
      background: #fff;
      border-radius: 40px 40px 0 0;
      padding: 2px 1px 0;
      min-height: 100%;
    }
    .cliche-center .logo-wrap {
      width: 100%;
      max-width: 76px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 2px;
      border-radius: 14px;
      overflow: hidden;
    }
    .cliche-center img {
      width: 100%;
      max-width: 76px;
      height: auto;
      max-height: 86px;
      object-fit: contain;
      display: block;
      border-radius: 12px;
    }
    .cliche-center .logo-fallback {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: #2a2a2a;
      color: var(--cliche-gold);
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 800;
    }
    .cliche-panel {
      position: relative;
      color: var(--cliche-ink);
      margin-right: -22px;
      width: calc(100% + 22px);
      box-sizing: border-box;
      padding: 8px 28px 8px 10px;
      min-height: 96px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      z-index: 2;
      overflow: hidden;
      border-radius: 14px 80px 36px 12px;
    }
    .cliche-panel .gold-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }
    .cliche-panel .panel-inner {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .cliche-panel .addr {
      font-size: 10.5px;
      font-weight: 800;
      display: flex;
      align-items: flex-start;
      gap: 4px;
      line-height: 1.35;
    }
    .cliche-panel .pill {
      border: 1.4px solid #fff;
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 10px;
      font-weight: 700;
      color: var(--cliche-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media print {
      .cliche-v2, .cliche-panel, .cliche-bar-mgmt, .gold-svg {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  `
}

/** HTML كليشة مع ذهب SVG يطبع دائماً */
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

  const panelSvg = `<svg class="gold-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 400 140" aria-hidden="true">
    <path fill="${escapeHtml(gold)}" d="M18,0 H270 C340,0 400,28 400,70 C400,112 340,140 270,140 H18 C8,140 0,132 0,122 V18 C0,8 8,0 18,0 Z"/>
  </svg>`

  const barSvg = `<svg class="gold-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 400 40" aria-hidden="true">
    <path fill="${escapeHtml(gold)}" d="M48,0 H400 V40 H0 C28,40 48,22 48,0 Z"/>
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
          ${barSvg}
          <span class="bar-text">${mgmt ? `الإدارة : ${escapeHtml(mgmt)}` : '&nbsp;'}</span>
        </div>
      </div>
      <div class="cliche-center">
        <div class="logo-cradle">
          <div class="logo-wrap">
            ${
              logoUrl
                ? `<img src="${logoUrl}" alt="" />`
                : `<div class="logo-fallback">أس</div>`
            }
          </div>
        </div>
      </div>
      <div class="cliche-panel">
        ${panelSvg}
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
  </div>`
}
