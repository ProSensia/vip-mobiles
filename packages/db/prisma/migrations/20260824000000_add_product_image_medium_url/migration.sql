-- Adds the medium (800px) rendition URL that processProductImage already
-- generated and saved to disk, but never persisted — product listing/grid
-- cards were falling back to the 1600px "large" rendition instead.
ALTER TABLE `ProductImage` ADD COLUMN `mediumUrl` VARCHAR(191) NULL;
