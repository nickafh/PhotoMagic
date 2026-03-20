import { handlers } from "@/auth";
import { NextRequest } from "next/server";
import { getTenantByHostname } from "@/lib/tenant";

function resolveAuthUrl(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  const tenant = getTenantByHostname(host);
  process.env.AUTH_URL = tenant.baseUrl;
}

export const GET = (req: NextRequest) => {
  resolveAuthUrl(req);
  return handlers.GET(req);
};

export const POST = (req: NextRequest) => {
  resolveAuthUrl(req);
  return handlers.POST(req);
};
