-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Empresa de Distribución de Diésel',
    "rnc" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tankCapacity" DECIMAL(10,2) NOT NULL DEFAULT 20000,
    "alertRedGallons" DECIMAL(10,2) NOT NULL DEFAULT 2000,
    "alertYellowGallons" DECIMAL(10,2) NOT NULL DEFAULT 4000,
    "defaultFuelPrice" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
