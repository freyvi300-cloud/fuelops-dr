-- AlterTable
ALTER TABLE "WhatsAppImage" ADD COLUMN     "ocrConfidence" INTEGER,
ADD COLUMN     "ocrGallons" DECIMAL(10,2),
ADD COLUMN     "ocrNotes" TEXT,
ADD COLUMN     "ocrProcessedAt" TIMESTAMP(3),
ADD COLUMN     "ocrProvider" TEXT,
ADD COLUMN     "ocrQuality" TEXT,
ADD COLUMN     "ocrRawText" TEXT;
