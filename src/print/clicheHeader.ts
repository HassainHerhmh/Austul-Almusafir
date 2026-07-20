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

/** CSS كليشة بنسق الصورة المرجعية */
export function clicheHeaderCss(s: PrintSettings = DEFAULT_PRINT_SETTINGS) {
  return `
    .cliche-v2 {
      position: relative;
      margin: 0 0 16px;
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    }
    .cliche-top {
      display: grid;
      /* في RTL: العمود الأول يمين الصفحة */
      grid-template-columns: 1.3fr 0.9fr 1.35fr;
      gap: 4px;
      align-items: end;
      min-height: 120px;
    }
    .cliche-identity {
      text-align: right;
      padding: 4px 4px 30px;
      z-index: 2;
    }
    .cliche-identity .ar-name {
      font-size: 19px;
      font-weight: 800;
      color: ${s.primaryColor};
      line-height: 1.35;
      margin: 0;
    }
    .cliche-identity .en-name {
      font-size: 12.5px;
      font-weight: 700;
      color: ${s.accentColor};
      margin-top: 3px;
    }
    .cliche-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      text-align: center;
      position: relative;
      z-index: 6;
      margin-bottom: -18px;
      padding-bottom: 2px;
    }
    .cliche-logo .logo-bubble {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #fff;
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 5px #fff;
    }
    .cliche-logo img {
      width: 82px;
      height: 82px;
      object-fit: contain;
    }
    .cliche-logo .logo-fallback {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: linear-gradient(145deg, ${s.accentColor}, #9a7a18);
      color: #fff;
      display: grid;
      place-items: center;
      font-size: 26px;
      font-weight: 800;
    }
    .cliche-logo .logo-caption {
      margin-top: 2px;
      font-size: 10.5px;
      font-weight: 800;
      color: ${s.primaryColor};
      max-width: 150px;
      line-height: 1.25;
    }
    .cliche-panel {
      background: ${s.accentColor};
      color: ${s.primaryColor};
      /* حافة يمين اللوحة منحنية باتجاه الشعار */
      border-radius: 18px 55px 55px 18px;
      padding: 12px 20px 12px 14px;
      min-height: 112px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
      position: relative;
      z-index: 2;
    }
    .cliche-panel .addr {
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: flex-start;
      gap: 5px;
      line-height: 1.4;
    }
    .cliche-panel .pill {
      border: 1.6px solid #fff;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      color: ${s.primaryColor};
      background: transparent;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cliche-bar {
      display: grid;
      grid-template-columns: 1.3fr 0.9fr 1.35fr;
      align-items: end;
      margin-top: 0;
      min-height: 32px;
    }
    /* يمين — شريط الإدارة الذهبي */
    .cliche-bar .bar-mgmt {
      background: ${s.accentColor};
      border-radius: 28px 0 0 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 800;
      color: #1a1205;
      min-height: 32px;
    }
    /* وسط — قوس تحت الشعار */
    .cliche-bar .bar-notch {
      background: ${s.accentColor};
      height: 26px;
      border-radius: 40px 40px 0 0;
    }
    .cliche-bar .bar-space { background: transparent; }
  `
}

/** HTML كليشة مطابقة للصورة المرجعية */
export function buildClicheHeaderHtml(opts: {
  brandName: string
  logoUrl?: string | null
  phones?: string
  settings?: PrintSettings
}) {
  const s = opts.settings ?? DEFAULT_PRINT_SETTINGS
  const brandName = opts.brandName || 'أسطول المسافر'
  const logoUrl = opts.logoUrl || null
  const brandPhoneLines = splitLines((opts.phones || '').replace(/,/g, '\n').replace(/،/g, '\n'))
  const brandPhonesJoined = brandPhoneLines.join(' - ')

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

  return `
  <div class="cliche-v2">
    <div class="cliche-top">
      <div class="cliche-identity">
        <div class="ar-name">${escapeHtml(brandName)}</div>
        ${s.nameEn ? `<div class="en-name">${escapeHtml(s.nameEn)}</div>` : ''}
      </div>
      <div class="cliche-logo">
        <div class="logo-bubble">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="" />`
              : `<div class="logo-fallback">أس</div>`
          }
        </div>
        <div class="logo-caption">${escapeHtml(brandName)}</div>
      </div>
      <div class="cliche-panel">
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
    <div class="cliche-bar">
      <div class="bar-mgmt">${mgmt ? `الإدارة : ${escapeHtml(mgmt)}` : '&nbsp;'}</div>
      <div class="bar-notch"></div>
      <div class="bar-space"></div>
    </div>
  </div>`
}
