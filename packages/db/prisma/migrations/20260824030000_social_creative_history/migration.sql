-- Post History gallery: a lightweight thumbnail so the history list never
-- has to load full-resolution generated images, plus soft-delete so
-- deleted posts keep an audit trail without keeping the files around.
ALTER TABLE `SocialCreative` ADD COLUMN `thumbUrl` VARCHAR(191) NULL;
ALTER TABLE `SocialCreative` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `SocialCreative_deletedAt_createdAt_idx` ON `SocialCreative`(`deletedAt`, `createdAt`);
