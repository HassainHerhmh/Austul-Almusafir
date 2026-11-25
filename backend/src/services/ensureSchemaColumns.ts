import { prisma } from '../config'
import { logger } from '../utils/logger'

function isIgnorableMysqlError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err)
  return (
    /1060|Duplicate column name/i.test(text) ||
    /1050|Table.*already exists/i.test(text) ||
    /1061|Duplicate key name/i.test(text) ||
    /1091|check that column\/key exists/i.test(text) ||
    /1072|Key column.*doesn't exist/i.test(text) ||
    /1826|Duplicate foreign key/i.test(text) ||
    /1215|Cannot add foreign key/i.test(text) ||
    /1005|Unknown table/i.test(text)
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
  'ALTER TABLE `Bus` ADD COLUMN `chassisNumber` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `operatingNumber` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `busTypeId` VARCHAR(191) NULL',
  'ALTER TABLE `Bus` ADD COLUMN `busModelId` VARCHAR(191) NULL',
  'ALTER TABLE `Bus` ADD COLUMN `insuranceCompanyId` VARCHAR(191) NULL',
  'ALTER TABLE `Bus` ADD COLUMN `insuranceExpiry` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `registrationExpiry` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `operatingCardExpiry` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `initialOdometer` VARCHAR(191) NOT NULL DEFAULT \'\'',
  'ALTER TABLE `Bus` ADD COLUMN `notes` VARCHAR(500) NOT NULL DEFAULT \'\'',
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

/** جداول صيانات الحافلات — يُكمّل db push على Hostinger */
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS \`RepairType\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`branchId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`RepairType_branchId_idx\` (\`branchId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`SparePart\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`partCode\` VARCHAR(191) NOT NULL DEFAULT '',
    \`unitPrice\` DOUBLE NOT NULL DEFAULT 0,
    \`branchId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`SparePart_branchId_idx\` (\`branchId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`BusMaintenanceExpense\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`busId\` VARCHAR(191) NOT NULL,
    \`repairTypeId\` VARCHAR(191) NOT NULL,
    \`maintenanceDate\` VARCHAR(191) NOT NULL,
    \`costBeforeDiscount\` DOUBLE NOT NULL DEFAULT 0,
    \`discountType\` VARCHAR(191) NOT NULL DEFAULT 'none',
    \`discountValue\` DOUBLE NOT NULL DEFAULT 0,
    \`finalCost\` DOUBLE NOT NULL DEFAULT 0,
    \`notes\` VARCHAR(500) NOT NULL DEFAULT '',
    \`creditAccountId\` INT NULL,
    \`branchId\` VARCHAR(191) NULL,
    \`journalReferenceId\` INT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`BusMaintenanceExpense_branchId_idx\` (\`branchId\`),
    INDEX \`BusMaintenanceExpense_busId_idx\` (\`busId\`),
    INDEX \`BusMaintenanceExpense_repairTypeId_idx\` (\`repairTypeId\`),
    INDEX \`BusMaintenanceExpense_maintenanceDate_idx\` (\`maintenanceDate\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`BusType\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`branchId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`BusType_branchId_idx\` (\`branchId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`BusModelCatalog\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`branchId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`BusModelCatalog_branchId_idx\` (\`branchId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS \`InsuranceCompany\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`phone\` VARCHAR(191) NOT NULL DEFAULT '',
    \`branchId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`InsuranceCompany_branchId_idx\` (\`branchId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
]

const MAINTENANCE_FKS = [
  'ALTER TABLE `RepairType` ADD CONSTRAINT `RepairType_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'ALTER TABLE `SparePart` ADD CONSTRAINT `SparePart_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'ALTER TABLE `BusMaintenanceExpense` ADD CONSTRAINT `BusMaintenanceExpense_busId_fkey` FOREIGN KEY (`busId`) REFERENCES `Bus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'ALTER TABLE `BusMaintenanceExpense` ADD CONSTRAINT `BusMaintenanceExpense_repairTypeId_fkey` FOREIGN KEY (`repairTypeId`) REFERENCES `RepairType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'ALTER TABLE `BusMaintenanceExpense` ADD CONSTRAINT `BusMaintenanceExpense_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
]

async function runSqlBatch(label: string, statements: string[]) {
  let applied = 0
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql)
      applied++
    } catch (err) {
      if (!isIgnorableMysqlError(err)) {
        logger.error(label, { sql: sql.slice(0, 120), err })
      }
    }
  }
  return applied
}

/** يُكمّل prisma db push عند فشله — أعمدة branchId + جداول الصيانات */
export async function ensureBranchColumnsRaw(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch {
    logger.warn('db-schema', 'تخطي SQL الاحتياطي — لا اتصال بقاعدة البيانات')
    return
  }

  const cols = await runSqlBatch('db-columns', ADD_COLUMNS)
  const tables = await runSqlBatch('db-schema', CREATE_TABLES)
  await runSqlBatch('db-schema', MAINTENANCE_FKS)
  await runSqlBatch('db-columns', INDEXES)
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
  if (cols > 0) {
    logger.info('db-columns', `تمت إضافة ${cols} عمود`)
  }
  if (tables > 0) {
    logger.info('db-schema', `تم إنشاء/تحديث ${tables} جدول صيانة`)
  }
}