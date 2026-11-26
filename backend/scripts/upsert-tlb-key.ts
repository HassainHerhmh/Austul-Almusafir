/**
 * تحديث مفتاح الهيئة النشط في قاعدة البيانات (مرة واحدة على السيرفر).
 * لا تضع الأسرار في هذا الملف — مرّرها من متغيرات البيئة فقط.
 *
 * مثال (PowerShell):
 *   $env:TLB_COMPANY_ID="123123"
 *   $env:TLB_API_KEY="..."
 *   $env:TLB_API_SECRET="..."
 *   $env:TLB_API_SECRET_PROTECTED="..."  # اختياري
 *   npx tsx scripts/upsert-tlb-key.ts
 */
import { prisma } from '../src/config'
import {
  DEFAULT_TLB_PERMISSIONS,
  normalizeTlbCredential,
  normalizeTlbPermissions,
} from '../src/services/tlbPassengerApi'

async function main() {
  const companyId = normalizeTlbCredential(process.env.TLB_COMPANY_ID ?? '123123')
  const apiKey = normalizeTlbCredential(process.env.TLB_API_KEY ?? '')
  const apiSecret = normalizeTlbCredential(process.env.TLB_API_SECRET ?? '')
  const apiSecretProtected = process.env.TLB_API_SECRET_PROTECTED
    ? normalizeTlbCredential(process.env.TLB_API_SECRET_PROTECTED)
    : null
  const apiBaseUrl =
    normalizeTlbCredential(process.env.TLB_API_BASE_URL ?? '') ||
    'https://apicomny-001-site1.htempurl.com/'

  if (!apiKey || !apiSecret) {
    console.error('عيّن TLB_API_KEY و TLB_API_SECRET')
    process.exit(1)
  }

  const permissions = normalizeTlbPermissions({
    ...DEFAULT_TLB_PERMISSIONS,
    passengerSend: true,
    useHmacSignature: true,
    autoOnBooking: false,
  })

  const active = await prisma.tlbApiKey.findFirst({
    where: { isActive: 1 },
    orderBy: { apiId: 'desc' },
  })

  const data = {
    companyId,
    apiNAme: process.env.TLB_API_NAME?.trim() || 'مفتاح تجريبي — الهيئة',
    apiKey,
    apiSecret,
    apiSecretProtected: apiSecretProtected,
    apiBaseUrl,
    isActive: 1,
    permissions,
  }

  const row = active
    ? await prisma.tlbApiKey.update({ where: { apiId: active.apiId }, data })
    : await prisma.tlbApiKey.create({ data })

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiId: row.apiId,
        companyId: row.companyId,
        apiKeySuffix: apiKey.slice(-4),
        apiBaseUrl: row.apiBaseUrl,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())