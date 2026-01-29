import { getListingById } from "@/lib/store";
import { streamListingZip } from "@/lib/zip";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx): Promise<string> {
  const resolved = await Promise.resolve(ctx.params as any);
  return resolved.id;
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = await getId(ctx);
  const listing = await getListingById(id);
  if (!listing) {
    return new Response("Not found", { status: 404 });
  }

  // Next.js Route Handlers use Web Streams; easiest is to use Node response via "Response" streaming is limited.
  // We'll use a small workaround: create a ReadableStream from archiver is more work.
  // For now: return a 501 until we wire a proper stream OR use a simple buffer zip approach.
  return new Response("Download route wired, but streaming Response not implemented yet.", { status: 501 });
}