-- CreateIndex
CREATE INDEX "Listing_userId_status_idx" ON "Listing"("userId", "status");

-- CreateIndex
CREATE INDEX "Listing_updatedAt_idx" ON "Listing"("updatedAt");

-- CreateIndex
CREATE INDEX "PhotoOrderSubmission_listingId_status_idx" ON "PhotoOrderSubmission"("listingId", "status");

-- CreateIndex
CREATE INDEX "PhotoOrderSubmission_createdAt_idx" ON "PhotoOrderSubmission"("createdAt");
