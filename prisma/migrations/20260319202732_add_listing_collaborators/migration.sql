-- CreateTable
CREATE TABLE "_ListingCollaborators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ListingCollaborators_A_fkey" FOREIGN KEY ("A") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ListingCollaborators_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ListingCollaborators_AB_unique" ON "_ListingCollaborators"("A", "B");

-- CreateIndex
CREATE INDEX "_ListingCollaborators_B_index" ON "_ListingCollaborators"("B");
