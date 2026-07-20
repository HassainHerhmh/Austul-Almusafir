/** تحويل أرقام بسيطة إلى كلمات عربية (للمبالغ في السندات) */

const ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
]

const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']

const HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
]

function underThousand(n: number): string {
  if (n <= 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    if (!o) return TENS[t]
    return `${ONES[o]} و${TENS[t]}`
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (!rest) return HUNDREDS[h]
  return `${HUNDREDS[h]} و${underThousand(rest)}`
}

function scaleWord(n: number, singular: string, dual: string, plural: string): string {
  if (n === 1) return singular
  if (n === 2) return dual
  if (n >= 3 && n <= 10) return `${underThousand(n)} ${plural}`
  return `${underThousand(n)} ${singular}`
}

/** مثال: 15464 → خمسة عشر ألفاً وأربعمائة وأربعة وستون */
export function numberToArabicWords(value: number): string {
  const n = Math.floor(Math.abs(Number(value) || 0))
  if (n === 0) return 'صفر'

  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000

  if (millions) {
    parts.push(scaleWord(millions, 'مليون', 'مليونان', 'ملايين'))
  }
  if (thousands) {
    if (thousands === 1) parts.push('ألف')
    else if (thousands === 2) parts.push('ألفان')
    else if (thousands >= 3 && thousands <= 10) parts.push(`${underThousand(thousands)} آلاف`)
    else parts.push(`${underThousand(thousands)} ألفاً`)
  }
  if (rest) parts.push(underThousand(rest))

  return parts.join(' و')
}
