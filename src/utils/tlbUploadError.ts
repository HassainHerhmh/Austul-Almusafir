import { ApiError } from '../api/client'

/** نص تنبيه يضم الرد الخام من سيرفر الهيئة للتشخيص */
export function formatTlbUploadError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : 'فشل الرفع للهيئة'
  }
  const lines: string[] = [err.message]
  const d = err.tlb?.diagnostics
  if (d) {
    lines.push(
      '',
      '—— تفاصيل السيرفر (للتشخيص) ——',
      `الرابط: ${d.requestUrl}`,
      `وصل طلب للهيئة: ${d.reachedAuthority ? 'نعم' : 'لا — رابط أو شبكة'}`,
      `HTTP: ${d.httpStatus ?? '—'}`,
      `CompanyId المستخدم: ${d.companyId}`,
      `ApiKey (آخر 4 أحرف): ${d.apiKeySuffix}`,
      `التوثيق: ${d.authMode === 'hmac' ? 'HMAC (X-Signature)' : 'X-API-KEY فقط'}`,
    )
    if (d.tlbApiKeyId != null) lines.push(`سجل المفتاح في النظام: ApiID ${d.tlbApiKeyId}`)
    const diag = d as { bodySha256Hex?: string; canonicalString?: string }
    if (diag.bodySha256Hex) lines.push(`SHA256 للجسم (hex): ${diag.bodySha256Hex}`)
    if (diag.canonicalString) {
      lines.push('', 'نص التوقيع المعتمد (للهيئة):', diag.canonicalString.slice(0, 500))
    }
  }
  const raw = err.tlb?.responseBody?.trim() || d?.rawResponseBody?.trim()
  if (raw) {
    lines.push('', 'الرد الخام من الهيئة:', raw.length > 1500 ? `${raw.slice(0, 1500)}…` : raw)
  }
  return lines.join('\n')
}