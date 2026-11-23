-- نفّذ فقط إذا Office و User لديهما branchId مسبقاً (خطأ 1060 طبيعي)
-- الأعمدة التي تسبب 500: Trip, Destination, VisaType, Account, Bus, Driver

ALTER TABLE `Bus` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Driver` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Trip` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Destination` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `VisaType` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Account` ADD COLUMN `branchId` VARCHAR(191) NULL;

CREATE INDEX `Bus_branchId_idx` ON `Bus` (`branchId`);
CREATE INDEX `Driver_branchId_idx` ON `Driver` (`branchId`);
CREATE INDEX `Trip_branchId_idx` ON `Trip` (`branchId`);
CREATE INDEX `Destination_branchId_idx` ON `Destination` (`branchId`);
CREATE INDEX `VisaType_branchId_idx` ON `VisaType` (`branchId`);
CREATE INDEX `Account_branchId_idx` ON `Account` (`branchId`);

ALTER TABLE `Account` DROP INDEX `Account_code_key`;
ALTER TABLE `Account` ADD UNIQUE INDEX `Account_code_branchId_key` (`code`, `branchId`);