import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Okta from "next-auth/providers/okta";
import prisma from "@/lib/db";

// Types for session augmentation
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "ADVISOR" | "LISTINGS" | "ADMIN";
      oktaId?: string;
    };
  }
}

// Extended JWT type for our custom fields
interface ExtendedJWT extends JWT {
  id?: string;
  oktaId?: string;
  role?: "ADVISOR" | "LISTINGS" | "ADMIN";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Okta({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer: process.env.OKTA_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      const extToken = token as ExtendedJWT;

      // On sign in, store the Okta ID and fetch/create user from DB
      if (account?.providerAccountId) {
        extToken.oktaId = account.providerAccountId;

        // Upsert user in database and get their role
        const user = await prisma.user.upsert({
          where: { oktaId: account.providerAccountId },
          update: {
            email: profile?.email || (token.email as string),
            name: profile?.name || (token.name as string),
          },
          create: {
            oktaId: account.providerAccountId,
            email: profile?.email || (token.email as string),
            name: profile?.name || (token.name as string),
            role: "ADVISOR",
          },
        });

        extToken.id = user.id;
        extToken.role = user.role as "ADVISOR" | "LISTINGS" | "ADMIN";
      }

      if (profile?.email) {
        extToken.email = profile.email;
      }
      if (profile?.name) {
        extToken.name = profile.name;
      }

      return extToken;
    },
    async session({ session, token }) {
      const extToken = token as ExtendedJWT;

      if (session.user) {
        session.user.id = extToken.id || "";
        session.user.oktaId = extToken.oktaId;
        session.user.email = (extToken.email as string) || "";
        session.user.name = extToken.name as string | undefined;
        session.user.role = extToken.role || "ADVISOR";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
});
