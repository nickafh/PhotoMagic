import { NextResponse } from "next/server";
import { addPhotoToListing } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params as any);
  return p.id;
}

export async function POST(req: Request, ctx: Ctx) {
  const id = await getId(ctx);

  const form = await req.formData();
  const files = form.getAll("files");

  for (const f of files) {
    if (!(f instanceof File)) continue;
    const buf = Buffer.from(await f.arrayBuffer());

    await addPhotoToListing({
      listingId: id,
      buffer: buf,
      originalName: f.name,
      mime: f.type,
    });
  }

  return NextResponse.json({ ok: true });
}