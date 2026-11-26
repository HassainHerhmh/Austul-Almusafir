import type { PrismaClient } from '@prisma/client'
import { prisma } from '../config'

export const TRIP_NUMBER_START = 1001
const COUNTER_ID = 'tripNumber'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export async function allocateTripNumber(tx: Tx): Promise<number> {
  await tx.appCounter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, value: TRIP_NUMBER_START - 1 },
    update: {},
  })
  const updated = await tx.appCounter.update({
    where: { id: COUNTER_ID },
    data: { value: { increment: 1 } },
  })
  return updated.value
}

export async function ensureTripNumbers() {
  const missing = await prisma.trip.findMany({
    where: { tripNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (missing.length === 0) return

  const maxExisting = await prisma.trip.aggregate({ _max: { tripNumber: true } })
  let next = Math.max(TRIP_NUMBER_START, (maxExisting._max.tripNumber ?? 0) + 1)

  for (const row of missing) {
    await prisma.trip.update({
      where: { id: row.id },
      data: { tripNumber: next },
    })
    next++
  }

  await prisma.appCounter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, value: next - 1 },
    update: { value: next - 1 },
  })
}