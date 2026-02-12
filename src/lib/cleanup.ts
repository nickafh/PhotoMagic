import { getOldListings, deleteListing } from "@/lib/store";

const DAYS_TO_KEEP = 30;

export interface CleanupResult {
  deletedCount: number;
  deletedIds: string[];
  errors: string[];
}

export async function cleanupOldListings(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    deletedIds: [],
    errors: [],
  };

  try {
    const oldListings = await getOldListings(DAYS_TO_KEEP);

    console.log(`Found ${oldListings.length} listings older than ${DAYS_TO_KEEP} days`);

    for (const listing of oldListings) {
      try {
        await deleteListing(listing.id);
        result.deletedCount++;
        result.deletedIds.push(listing.id);
        console.log(`Deleted listing ${listing.id} (${listing.address})`);
      } catch (error) {
        const message = `Failed to delete listing ${listing.id}: ${error}`;
        console.error(message);
        result.errors.push(message);
      }
    }
  } catch (error) {
    const message = `Failed to fetch old listings: ${error}`;
    console.error(message);
    result.errors.push(message);
  }

  return result;
}
