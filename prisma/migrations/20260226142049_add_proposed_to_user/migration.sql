-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PhotoOrderSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "initiatorRole" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "orderedPhotoIds" TEXT NOT NULL,
    "note" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "proposedToUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    CONSTRAINT "PhotoOrderSubmission_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoOrderSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PhotoOrderSubmission_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoOrderSubmission_proposedToUserId_fkey" FOREIGN KEY ("proposedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PhotoOrderSubmission" ("approvedAt", "approvedByUserId", "approverRole", "createdAt", "id", "initiatorRole", "listingId", "note", "orderedPhotoIds", "status", "submittedAt", "submittedByUserId", "updatedAt") SELECT "approvedAt", "approvedByUserId", "approverRole", "createdAt", "id", "initiatorRole", "listingId", "note", "orderedPhotoIds", "status", "submittedAt", "submittedByUserId", "updatedAt" FROM "PhotoOrderSubmission";
DROP TABLE "PhotoOrderSubmission";
ALTER TABLE "new_PhotoOrderSubmission" RENAME TO "PhotoOrderSubmission";
CREATE INDEX "PhotoOrderSubmission_listingId_idx" ON "PhotoOrderSubmission"("listingId");
CREATE INDEX "PhotoOrderSubmission_status_idx" ON "PhotoOrderSubmission"("status");
CREATE INDEX "PhotoOrderSubmission_proposedToUserId_idx" ON "PhotoOrderSubmission"("proposedToUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
