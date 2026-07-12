-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CREDIT');

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "supplyId" TEXT;

-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "truckId" TEXT,
    "gallons" DECIMAL(10,2) NOT NULL,
    "pricePerGallon" DECIMAL(10,4) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'CREDIT',
    "meterPhotoB64" TEXT,
    "notes" TEXT,
    "suppliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
