import { NextResponse } from "next/server";
import { cleanupOldListings } from "@/lib/cleanup";

export const runtime = "nodejs";

// GET /api/cron/cleanup - Run cleanup job
// This endpoint is called by a cron service (e.g., Vercel Cron)
// It's protected by CRON_SECRET to prevent unauthorized access
export async function GET(req: Request) {
  // Verify the request is from authorized source
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it to be provided
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // In development, allow without secret but log warning
    console.warn("CRON_SECRET not set - running cleanup without auth check");
  }

  console.log("Starting cleanup job...");

  try {
    const result = await cleanupOldListings();

    console.log(`Cleanup complete: deleted ${result.deletedCount} listings`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Cleanup job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
