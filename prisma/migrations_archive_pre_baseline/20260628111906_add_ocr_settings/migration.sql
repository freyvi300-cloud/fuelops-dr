-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "ocrEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ocrMinConfidence" INTEGER NOT NULL DEFAULT 90;
