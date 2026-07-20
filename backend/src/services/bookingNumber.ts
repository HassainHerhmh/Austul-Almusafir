import type { PrismaClient } from '@prisma/client'
import { prisma } from '../config'

/** أول رقم حجز تسلسلي للنظام */
export const BOOKING_NUMBER_START = 1578
const COUNTER_ID = 'bookingNumber'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/** يحجز الرقم التالي بشكل ذري داخل معاملة */
export async function allocateBookingNumber(tx: Tx): Promise<number> {
  await tx.appCounter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, value: BOOKING_NUMBER_START - 1 },
    update: {},
  })
  const updated = await tx.appCounter.update({
    where: { id: COUNTER_ID },
    data: { value: { increment: 1 } },
  })
  return updated.value
}

/** يرقّم الحجوزات القديمة ويضبط العدّاد على أعلى رقم */
export async function ensureBookingNumbers() {
  const missing = await prisma.booking.findMany({
    where: { bookingNumber: null },
    orderBy: { bookedAt: 'asc' },
    select: { id: true },
  })

  if (missing.length > 0) {
    const maxExisting = await prisma.booking.aggregate({
      _max: { bookingNumber: true },
    })
    let next = Math.max(
      BOOKING_NUMBER_START,
      (maxExisting._max.bookingNumber ?? BOOKING_NUMBER_START - 1) + 1,
    )
    for (const row of missing) {
      await prisma.booking.update({
        where: { id: row.id },
        data: { bookingNumber: next },
      })
      next += 1
    }
  }

  const maxAll = await prisma.booking.aggregate({
    _max: { bookingNumber: true },
  })
  const floor = Math.max(BOOKING_NUMBER_START - 1, maxAll._max.bookingNumber ?? BOOKING_NUMBER_START - 1)

  const current = await prisma.appCounter.findUnique({ where: { id: COUNTER_ID } })
  if (!current) {
    await prisma.appCounter.create({ data: { id: COUNTER_ID, value: floor } })
  } else if (current.value < floor) {
    await prisma.appCounter.update({
      where: { id: COUNTER_ID },
      data: { value: floor },
    })
  }
}
