import { prisma } from '../config'
import { logger } from '../utils/logger'

function isIgnorableMysqlError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err)
  return (
    /1060|Duplicate column name/i.test(text) ||
    /1061|Duplicate key name/i.test(text) ||
    /1091|check that column\/key exists/i.test(text)
  )
}

const ADD_COLUMNS = [
  'ALTER TABLE `Bus` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Driver` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Trip` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Destination` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `VisaType` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Account` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Account` ADD COLUMN `createdByName` VARCHAR(191) NULL',
  'ALTER TABLE `Office` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `User` ADD COLUMN `branchId` VARCHAR(191) NULL',
  'ALTER TABLE `Trip` ADD COLUMN `checkInTime` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Trip` ADD COLUMN `childPrice` DOUBLE NULL',
]

const INDEXES = [
  'CREATE INDEX `Bus_branchId_idx` ON `Bus` (`branchId`)',
  'CREATE INDEX `Driver_branchId_idx` ON `Driver` (`branchId`)',
  'CREATE INDEX `Trip_branchId_idx` ON `Trip` (`branchId`)',
  'CREATE INDEX `Destination_branchId_idx` ON `Destination` (`branchId`)',
  'CREATE INDEX `VisaType_branchId_idx` ON `VisaType` (`branchId`)',
  'CREATE INDEX `Account_branchId_idx` ON `Account` (`branchId`)',
  'CREATE INDEX `Office_branchId_idx` ON `Office` (`branchId`)',
  'CREATE INDEX `User_branchId_idx` ON `User` (`branchId`)',
]

/** يُكمّل prisma db push عند فشله — يضيف branchId إن نُقص */
export async function ensureBranchColumnsRaw(): Promise<void> {
  let applied = 0
  for (const sql of ADD_COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(sql)
      applied++
    } catch (err) {
      if (!isIgnorableMysqlError(err)) {
        logger.error('db-columns', { sql, err })
      }
    }
  }
  for (const sql of INDEXES) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (err) {
      if (!isIgnorableMysqlError(err)) {
        logger.error('db-columns', { sql, err })
      }
    }
  }
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE `Account` DROP INDEX `Account_code_key`')
  } catch (err) {
    if (!isIgnorableMysqlError(err)) logger.error('db-columns', err)
  }
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `Account` ADD UNIQUE INDEX `Account_code_branchId_key` (`code`, `branchId`)',
    )
  } catch (err) {
    if (!isIgnorableMysqlError(err)) logger.error('db-columns', err)
  }
  if (applied > 0) {
    logger.info('db-columns', `تمت إضافة ${applied} عمود branchId`)
  }
}