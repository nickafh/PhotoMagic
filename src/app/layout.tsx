import "./globals.css";
import type { Metadata } from "next";
import { Source_Sans_3, Amiri } from "next/font/google";
import { Providers } from "@/components/Providers";
import { TenantProvider } from "@/components/TenantProvider";
import { getTenant } from "@/lib/tenant";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const amiri = Amiri({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  return {
    title: tenant.appName,
    description: "Upload, arrange, and download listing photo sequences.",
    icons: {
      icon: [
        { url: `${tenant.favicon}.ico`, sizes: "any" },
        { url: `${tenant.favicon}-32x32.png`, sizes: "32x32", type: "image/png" },
        { url: `${tenant.favicon}-16x16.png`, sizes: "16x16", type: "image/png" },
      ],
      apple: `${tenant.favicon.replace("/favicon", "/apple-touch-icon")}.png`,
    },
    openGraph: {
      title: tenant.appName,
      description: `Listing photo management for ${tenant.name}`,
      url: tenant.baseUrl,
      siteName: tenant.appName,
      images: [
        {
          url: `${tenant.baseUrl}${tenant.ogImage}`,
          width: 1200,
          height: 630,
          alt: `${tenant.appName} - ${tenant.name}`,
        },
      ],
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenant();

  return (
    <html lang="en" className="light">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap"
        />
      </head>
      <body
        className={[
          sourceSans.variable,
          amiri.variable,
          "font-sans",
          "bg-background-light dark:bg-background-dark",
          "text-slate-900 dark:text-slate-100",
          "min-h-screen",
        ].join(" ")}
      >
        <Providers>
          <TenantProvider tenant={tenant}>{children}</TenantProvider>
        </Providers>
      </body>
    </html>
  );
}
