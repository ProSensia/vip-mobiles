-- Login lockout + forced password change.
ALTER TABLE `User` ADD COLUMN `failedLoginAttempts` INT NOT NULL DEFAULT 0;
ALTER TABLE `User` ADD COLUMN `lockedUntil` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

-- Bill/invoice attachment + review QR token on Sale.
ALTER TABLE `Sale` ADD COLUMN `billUrl` VARCHAR(191) NULL;
ALTER TABLE `Sale` ADD COLUMN `reviewToken` VARCHAR(191) NULL;
ALTER TABLE `Sale` ADD COLUMN `reviewSubmittedAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `Sale_reviewToken_key` ON `Sale`(`reviewToken`);

-- Review: photo, verified-purchase flag, and the optional link back to the sale that prompted it.
ALTER TABLE `Review` ADD COLUMN `saleId` VARCHAR(191) NULL;
ALTER TABLE `Review` ADD COLUMN `photoUrl` VARCHAR(191) NULL;
ALTER TABLE `Review` ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX `Review_saleId_key` ON `Review`(`saleId`);
ALTER TABLE `Review` ADD CONSTRAINT `Review_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
