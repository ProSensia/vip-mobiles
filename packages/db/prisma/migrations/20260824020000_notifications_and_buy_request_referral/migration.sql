-- Notification center + Buy Request referral/assignment workflow.

-- 1. Extend BuyRequestStatus with the richer workflow (existing values
--    NEW/CONTACTED/CLOSED are preserved so existing rows stay valid).
ALTER TABLE `BuyRequest` MODIFY COLUMN `status` ENUM('NEW','ASSIGNED','CONTACTED','ACCEPTED','REJECTED','CANCELLED','CLOSED') NOT NULL DEFAULT 'NEW';

-- 2. Referral/assignment on BuyRequest.
ALTER TABLE `BuyRequest` ADD COLUMN `assignedToId` VARCHAR(191) NULL;
CREATE INDEX `BuyRequest_assignedToId_idx` ON `BuyRequest`(`assignedToId`);
ALTER TABLE `BuyRequest` ADD CONSTRAINT `BuyRequest_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Per-user notification preferences (JSON, nullable — absent means all enabled).
ALTER TABLE `User` ADD COLUMN `notificationPrefs` JSON NULL;

-- 4. Notification inbox.
CREATE TABLE `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('BUY_REQUEST_NEW','BUY_REQUEST_REFERRED','BUY_REQUEST_STATUS_CHANGED','SALE_COMPLETED','LOW_STOCK','REVIEW_SUBMITTED','USER_CREATED','SYSTEM') NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `link` VARCHAR(300) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE INDEX `Notification_userId_isRead_idx` ON `Notification`(`userId`, `isRead`);
CREATE INDEX `Notification_userId_createdAt_idx` ON `Notification`(`userId`, `createdAt`);
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
