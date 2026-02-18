-- CreateTable
CREATE TABLE "PhotoOrderSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "initiatorRole" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "orderedPhotoIds" TEXT NOT NULL,
    "note" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    CONSTRAINT "PhotoOrderSubmission_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoOrderSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PhotoOrderSubmission_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PhotoOrderSubmission_listingId_idx" ON "PhotoOrderSubmission"("listingId");

-- CreateIndex
CREATE INDEX "PhotoOrderSubmission_status_idx" ON "PhotoOrderSubmission"("status");
