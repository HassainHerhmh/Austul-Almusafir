import type { TlbPassengerInput } from '../types'

/** تسميات واجهة عربية لحقول PassengerApi (أسماء الحقول كما في وثيقة الهيئة) */
export const TLB_FIELD_LABELS: Record<keyof TlbPassengerInput, string> = {
  TransltName: 'الاسم الأول (TransltName)',
  TransltScondName: 'اسم الأب (TransltScondName)',
  TransltThreeName: 'اسم الجد (TransltThreeName)',
  TransltLastName: 'اللقب (TransltLastName)',
  NumberPaspport: 'رقم جواز السفر (NumberPaspport)',
  TransltNationlity: 'الجنسية (TransltNationlity)',
  numbervisa: 'رقم التأشيرة (numbervisa)',
  MobileTranslt: 'رقم الهاتف (MobileTranslt)',
  SexTranslte: 'الجنس (SexTranslte)',
  DateCard: 'تاريخ إصدار الجواز (DateCard)',
  PlaceCard: 'مكان إصدار الجواز (PlaceCard)',
  PlaceAcess: 'مكان الوصول / ملاحظات (PlaceAcess)',
  typevisa2: 'نوع التأشيرة (typevisa2)',
}

export function buildPassengerDisplayName(tlb: TlbPassengerInput): string {
  return [tlb.TransltName, tlb.TransltScondName, tlb.TransltThreeName, tlb.TransltLastName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export const emptyTlbPassengerInput = (): TlbPassengerInput => ({
  TransltName: '',
  TransltScondName: '',
  TransltThreeName: '',
  TransltLastName: '',
  NumberPaspport: '',
  TransltNationlity: '',
  numbervisa: '',
  MobileTranslt: '',
  SexTranslte: '',
  PlaceAcess: '',
  DateCard: '',
  PlaceCard: '',
  typevisa2: '',
})