import prisma from "@/lib/db";

interface OktaUser {
  id: string;
  profile: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
}

function getNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function syncOktaOrg(apiToken: string, issuer: string): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  // Strip /oauth2/default or similar suffix to get the org URL
  const orgUrl = issuer.replace(/\/oauth2\/.*$/, "");

  let created = 0;
  let updated = 0;
  let total = 0;

  let nextUrl: string | null = `${orgUrl}/api/v1/users?limit=200`;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: {
        Authorization: `SSWS ${apiToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Okta API error ${res.status} from ${orgUrl}: ${body}`);
    }

    const users: OktaUser[] = await res.json();

    for (const oktaUser of users) {
      const name =
        oktaUser.profile.displayName ||
        [oktaUser.profile.firstName, oktaUser.profile.lastName]
          .filter(Boolean)
          .join(" ") ||
        undefined;

      const existing = await prisma.user.findUnique({
        where: { oktaId: oktaUser.id },
      });

      await prisma.user.upsert({
        where: { oktaId: oktaUser.id },
        update: {
          email: oktaUser.profile.email,
          name,
        },
        create: {
          oktaId: oktaUser.id,
          email: oktaUser.profile.email,
          name,
          role: "ADVISOR",
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
      total++;
    }

    // Follow pagination via Link header
    nextUrl = getNextUrl(res.headers.get("link"));
  }

  return { created, updated, total };
}

export async function syncUsersFromOkta(): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  let created = 0;
  let updated = 0;
  let total = 0;

  // Sync AFH Okta
  if (process.env.OKTA_API_TOKEN && process.env.OKTA_ISSUER) {
    const afh = await syncOktaOrg(process.env.OKTA_API_TOKEN, process.env.OKTA_ISSUER);
    created += afh.created;
    updated += afh.updated;
    total += afh.total;
  }

  // Sync MSIR Okta
  if (process.env.MSIR_OKTA_API_TOKEN && process.env.MSIR_OKTA_ISSUER) {
    const msir = await syncOktaOrg(process.env.MSIR_OKTA_API_TOKEN, process.env.MSIR_OKTA_ISSUER);
    created += msir.created;
    updated += msir.updated;
    total += msir.total;
  }

  if (total === 0) {
    throw new Error("No Okta API tokens configured");
  }

  return { created, updated, total };
}
