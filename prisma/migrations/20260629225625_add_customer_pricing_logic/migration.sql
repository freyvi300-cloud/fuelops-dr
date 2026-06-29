-- CreateEnum
CREATE TYPE "CustomerPriceType" AS ENUM ('FIXED', 'DISCOUNT_PCT');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "priceDiscount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceType" "CustomerPriceType" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "baseFuelPrice" DECIMAL(10,4) NOT NULL DEFAULT 0;
