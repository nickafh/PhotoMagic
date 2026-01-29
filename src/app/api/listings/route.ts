import { NextResponse } from "next/server";
import { createListing } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json();
  const address = String(body.address || "").trim();

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const listing = await createListing({
    address,
    title: body.title ? String(body.title) : undefined,
  });

  return NextResponse.json(listing);
}