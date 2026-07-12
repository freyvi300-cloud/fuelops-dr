-- CreateEnum
CREATE TYPE "OcrProvider" AS ENUM ('OPENAI', 'GEMINI', 'MOCK');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "ocrProvider" "OcrProvider" NOT NULL DEFAULT 'MOCK';
