import { headers } from "next/headers";

export type TenantConfig = {
  id: string;
  name: string;
  appName: string;
  logo: string;
  logoAlt: string;
  favicon: string;
  ogImage: string;
  fromEmail: string;
  listingsTeamEmail: string;
  baseUrl: string;
};

const TENANTS: Record<string, TenantConfig> = {
  afh: {
    id: "afh",
    name: "Atlanta Fine Homes Sotheby's International Realty",
    appName: "PhotoMagic",
    logo: "/brand/Atlanta Fine Homes_Horz_White.png",
    logoAlt: "Atlanta Fine Homes",
    favicon: "/favicon",
    ogImage: "/og-image.png",
    fromEmail: process.env.LISTINGS_TEAM_EMAIL || "",
    listingsTeamEmail: process.env.LISTINGS_TEAM_EMAIL || "",
    baseUrl: process.env.NEXTAUTH_URL || "https://photomagic.atlantafinehomes.com",
  },
  msir: {
    id: "msir",
    name: "Mountain Sotheby's International Realty",
    appName: "PhotoMagic",
    logo: "/brand/msir/logo-white.png",
    logoAlt: "Mountain Sotheby's International Realty",
    favicon: "/brand/msir/favicon",
    ogImage: "/brand/msir/og-image.png",
    fromEmail: process.env.MSIR_LISTINGS_TEAM_EMAIL || "",
    listingsTeamEmail: process.env.MSIR_LISTINGS_TEAM_EMAIL || "",
    baseUrl: process.env.MSIR_BASE_URL || "https://photomagic.mountainsir.com",
  },
};

export function getTenantByHostname(hostname: string): TenantConfig {
  if (hostname.includes("mountainsir")) {
    return TENANTS.msir;
  }
  return TENANTS.afh;
}

export function getTenantConfig(tenantId: string): TenantConfig {
  return TENANTS[tenantId] || TENANTS.afh;
}

export async function getTenant(): Promise<TenantConfig> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id") || "afh";
  return getTenantConfig(tenantId);
}
