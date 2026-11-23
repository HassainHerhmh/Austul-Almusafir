-- مزامنة جداول الفروع (المرحلة 1 + 2) على MySQL / phpMyAdmin
-- نفّذ على قاعدة u608667573_ostool ثم أعد تشغيل تطبيق Node

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

-- Office.branchId (نفّذ مرة واحدة — تجاهل الخطأ إن وُجد العمود)
ALTER TABLE `Office` ADD COLUMN `branchId` VARCHAR(191) NULL;
CREATE INDEX `Office_branchId_idx` ON `Office` (`branchId`);

-- User.branchId
ALTER TABLE `User` ADD COLUMN `branchId` VARCHAR(191) NULL;
CREATE INDEX `User_branchId_idx` ON `User` (`branchId`);

-- المرحلة 3 — branchId على الأسطول والحسابات (تجاهل إن وُجد العمود)
ALTER TABLE `Bus` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Driver` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Trip` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Destination` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `VisaType` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Account` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- تحقق سريع
SELECT id, username, branchId FROM `User` WHERE username = 'admin' LIMIT 1;