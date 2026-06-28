-- CreateTable
CREATE TABLE "WhatsAppImage" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "senderName" TEXT,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppImage_mediaId_key" ON "WhatsAppImage"("mediaId");
