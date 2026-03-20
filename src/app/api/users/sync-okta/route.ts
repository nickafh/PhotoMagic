import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { syncUsersFromOkta } from "@/lib/okta-sync";

export const runtime = "nodejs";

// POST /api/users/sync-okta - trigger Okta user sync (ADMIN only)
export async function POST() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.OKTA_API_TOKEN && !process.env.MSIR_OKTA_API_TOKEN) {
    return NextResponse.json(
      { error: "No Okta API tokens configured" },
      { status: 500 }
    );
  }

  try {
    const result = await syncUsersFromOkta();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Okta sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
