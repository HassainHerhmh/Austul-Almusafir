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
 * كليشة: إطار أصفر متصل ينقطع في الوسط بالشعار (فاصل)،
 * مع انحناءات من الجهتين — بدون نص إضافي تحت الشعار.
 */
export function clicheHeaderCss(s: PrintSettings = DEFAULT_PRINT_SETTINGS) {
  const gold = s.accentColor
  const ink = s.primaryColor
  return `
    .cliche-v2 {
      position: relative;
      margin: 0 0 18px;
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
      --cliche-gold: ${gold};
      --cliche-ink: ${ink};
    }
    .cliche-row {
      display: grid;
      /* RTL: العمود 1 = يمين الصفحة */
      grid-template-columns: minmax(0, 1.35fr) 110px minmax(0, 1.45fr);
      align-items: stretch;
      gap: 0;
      min-height: 118px;
    }

    /* —— يمين: الاسم فوق + شريط الإدارة أسفل (حافة منحنية نحو الشعار) —— */
    .cliche-right {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      padding-inline-end: 2px;
    }
    .cliche-identity {
      text-align: right;
      padding: 4px 6px 10px;
    }
    .cliche-identity .ar-name {
      font-size: 19px;
      font-weight: 800;
      color: var(--cliche-ink);
      line-height: 1.35;
      margin: 0;
    }
    .cliche-identity .en-name {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--cliche-gold);
      margin-top: 3px;
    }
    .cliche-bar-mgmt {
      background: var(--cliche-gold);
      color: var(--cliche-ink);
      /* الحافة باتجاه الشعار (يسار العنصر في RTL نحو الوسط) */
      border-radius: 42px 0 0 0;
      padding: 8px 14px 8px 22px;
      font-size: 12px;
      font-weight: 800;
      text-align: right;
      min-height: 34px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    /* —— وسط: الشعار فقط كفاصل أبيض بين طرفي الإطار —— */
    .cliche-center {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      position: relative;
      z-index: 4;
      padding: 0 2px 0;
      background: #fff;
    }
    .cliche-center .logo-wrap {
      width: 100%;
      max-width: 108px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 2px;
    }
    .cliche-center img {
      width: 100%;
      max-width: 104px;
      height: auto;
      max-height: 112px;
      object-fit: contain;
      display: block;
    }
    .cliche-center .logo-fallback {
      width: 88px;
      height: 88px;
      border-radius: 14px;
      background: #2a2a2a;
      color: var(--cliche-gold);
      display: grid;
      place-items: center;
      font-size: 22px;
      font-weight: 800;
    }

    /* —— يسار: لوحة ذهبية كاملة الارتفاع، حافة منحنية نحو الشعار —— */
    .cliche-panel {
      background: var(--cliche-gold);
      color: var(--cliche-ink);
      /* انحناء داخلي باتجاه الشعار (الحافة اليمنى للوحة نحو الوسط) */
      border-radius: 16px 70px 70px 16px;
      padding: 12px 22px 12px 14px;
      min-height: 118px;
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
      color: var(--cliche-ink);
      background: rgba(255,255,255,.12);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `
}

/** HTML كليشة — الشعار فاصل بلا نص إضافي تحته */
export function buildClicheHeaderHtml(opts: {
  brandName: string
  logoUrl?: string | null
  phones?: string
  settings?: PrintSettings
}) {
  const s = opts.settings ?? DEFAULT_PRINT_SETTINGS
  const brandName = opts.brandName || 'أسطول المسافر'
  const logoUrl = opts.logoUrl || null
  const brandPhoneLines = splitLines(
    (opts.phones || '').replace(/,/g, '\n').replace(/،/g, '\n'),
  )
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
    <div class="cliche-row">
      <div class="cliche-right">
        <div class="cliche-identity">
          <div class="ar-name">${escapeHtml(brandName)}</div>
          ${s.nameEn ? `<div class="en-name">${escapeHtml(s.nameEn)}</div>` : ''}
        </div>
        <div class="cliche-bar-mgmt">${
          mgmt ? `الإدارة : ${escapeHtml(mgmt)}` : '&nbsp;'
        }</div>
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
  </div>`
}
