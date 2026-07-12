-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "fuelPricePerGallon" DECIMAL(10,4) NOT NULL DEFAULT 0,
ADD COLUMN     "pendingGallons" DECIMAL(10,2) NOT NULL DEFAULT 0;
