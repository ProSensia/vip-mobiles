-- Adds Trending / Best Seller / PTA Approved flags for the storefront
-- badge system and admin merchandising sections.
ALTER TABLE `Product` ADD COLUMN `isTrending` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Product` ADD COLUMN `isBestSeller` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Product` ADD COLUMN `isPtaApproved` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Product_isTrending_idx` ON `Product`(`isTrending`);
CREATE INDEX `Product_isBestSeller_idx` ON `Product`(`isBestSeller`);
