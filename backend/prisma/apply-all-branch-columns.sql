-- ============================================================
-- إصلاح أعمدة الفروع (المرحلة 1 + 2 + 3) — phpMyAdmin
-- قاعدة: u608667573_ostool (أو قاعدة التطبيق الفعلية)
-- نفّذ السكربت كاملاً، تجاهل أخطاء «عمود موجود» أو «فهرس موجود»
-- ثم أعد تشغيل تطبيق Node على Hostinger
-- ============================================================

CREATE TABLE IF NOT EXISTS `Branch` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL DEFAULT '',
  `phone` VARCHAR(191) NOT NULL DEFAULT '',
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `ledgerAccountId` INT NULL,
  `commissionPercent` DOUBLE NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Office` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `branchId` VARCHAR(191) NULL;

ALTER TABLE `Bus` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Driver` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Trip` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Destination` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `VisaType` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Account` ADD COLUMN `branchId` VARCHAR(191) NULL;

CREATE INDEX `Office_branchId_idx` ON `Office` (`branchId`);
CREATE INDEX `User_branchId_idx` ON `User` (`branchId`);
CREATE INDEX `Bus_branchId_idx` ON `Bus` (`branchId`);
CREATE INDEX `Driver_branchId_idx` ON `Driver` (`branchId`);
CREATE INDEX `Trip_branchId_idx` ON `Trip` (`branchId`);
CREATE INDEX `Destination_branchId_idx` ON `Destination` (`branchId`);
CREATE INDEX `VisaType_branchId_idx` ON `VisaType` (`branchId`);
CREATE INDEX `Account_branchId_idx` ON `Account` (`branchId`);

-- حسابات: من فريد على code فقط → فريد على (code + branchId)
-- إن فشل DROP جرّب: SHOW INDEX FROM `Account`; واسم الفهرس الفريد على code
ALTER TABLE `Account` DROP INDEX `Account_code_key`;
ALTER TABLE `Account` ADD UNIQUE INDEX `Account_code_branchId_key` (`code`, `branchId`);

-- صيانات الحافلات (إن لم يُنشئها prisma db push)
CREATE TABLE IF NOT EXISTS `RepairType` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `RepairType_branchId_idx` (`branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SparePart` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `partCode` VARCHAR(191) NOT NULL DEFAULT '',
  `unitPrice` DOUBLE NOT NULL DEFAULT 0,
  `branchId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SparePart_branchId_idx` (`branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BusMaintenanceExpense` (
  `id` VARCHAR(191) NOT NULL,
  `busId` VARCHAR(191) NOT NULL,
  `repairTypeId` VARCHAR(191) NOT NULL,
  `maintenanceDate` VARCHAR(191) NOT NULL,
  `costBeforeDiscount` DOUBLE NOT NULL DEFAULT 0,
  `discountType` VARCHAR(191) NOT NULL DEFAULT 'none',
  `discountValue` DOUBLE NOT NULL DEFAULT 0,
  `finalCost` DOUBLE NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `creditAccountId` INT NULL,
  `branchId` VARCHAR(191) NULL,
  `journalReferenceId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BusMaintenanceExpense_branchId_idx` (`branchId`),
  INDEX `BusMaintenanceExpense_busId_idx` (`busId`),
  INDEX `BusMaintenanceExpense_repairTypeId_idx` (`repairTypeId`),
  INDEX `BusMaintenanceExpense_maintenanceDate_idx` (`maintenanceDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- تحقق
SHOW COLUMNS FROM `Trip` LIKE 'branchId';
SHOW COLUMNS FROM `Account` LIKE 'branchId';
SELECT 1 AS ok;