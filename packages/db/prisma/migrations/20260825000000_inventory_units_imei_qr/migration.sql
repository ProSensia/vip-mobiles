-- Sale.productId is no longer unique: once a product's stock is split into
-- serialized units, selling each unit produces its own Sale row, so a
-- product can now have more than one sale over its lifetime.
ALTER TABLE `Sale` DROP INDEX `Sale_productId_key`;
CREATE INDEX `Sale_productId_idx` ON `Sale`(`productId`);

-- Sale.unitId links a sale back to the specific scanned InventoryUnit it
-- came from. Null for a manually-recorded legacy sale with no serialized
-- unit behind it.
ALTER TABLE `Sale` ADD COLUMN `unitId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Sale_unitId_key` ON `Sale`(`unitId`);

-- CreateTable
CREATE TABLE `InventoryUnit` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `qrCode` VARCHAR(191) NULL,
    `imei1` VARCHAR(191) NULL,
    `imei2` VARCHAR(191) NULL,
    `purchasePrice` DECIMAL(10, 2) NULL,
    `status` ENUM('IN_STOCK', 'RESERVED', 'SOLD') NOT NULL DEFAULT 'IN_STOCK',
    `addedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `soldAt` DATETIME(3) NULL,

    UNIQUE INDEX `InventoryUnit_qrCode_key`(`qrCode`),
    UNIQUE INDEX `InventoryUnit_imei1_key`(`imei1`),
    UNIQUE INDEX `InventoryUnit_imei2_key`(`imei2`),
    INDEX `InventoryUnit_productId_idx`(`productId`),
    INDEX `InventoryUnit_variantId_idx`(`variantId`),
    INDEX `InventoryUnit_branchId_idx`(`branchId`),
    INDEX `InventoryUnit_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryUnit` ADD CONSTRAINT `InventoryUnit_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryUnit` ADD CONSTRAINT `InventoryUnit_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryUnit` ADD CONSTRAINT `InventoryUnit_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryUnit` ADD CONSTRAINT `InventoryUnit_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `InventoryUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
