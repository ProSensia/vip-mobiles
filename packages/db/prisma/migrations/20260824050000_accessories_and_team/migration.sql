-- Distinguishes accessory categories from phone categories so the dedicated
-- Accessories admin page/catalog can filter reliably.
ALTER TABLE `Category` ADD COLUMN `isAccessory` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `Category_isAccessory_idx` ON `Category`(`isAccessory`);
