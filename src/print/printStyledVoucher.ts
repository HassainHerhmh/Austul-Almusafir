import { serverApi } from '../api/serverApi'
import { normalizePrintSettings } from './printSettings'
import { printVoucherDocument, type VoucherPrintData } from './voucherDocument'

export async function printStyledVoucher(
  brand: { name: string; logoUrl: string | null; phones: string },
  voucher: VoucherPrintData,
) {
  let settings = normalizePrintSettings(null)
  try {
    const res = await serverApi.settings.print.get()
    settings = normalizePrintSettings(res.data)
  } catch {
    /* استخدم الافتراضي */
  }
  printVoucherDocument({
    brandName: brand.name,
    logoUrl: settings.printLogoUrl || brand.logoUrl,
    phones: brand.phones,
    settings,
    voucher,
  })
}
