import "./globals.css";
import type { Metadata } from "next";
import { Source_Sans_3, Amiri } from "next/font/google";
import { Providers } from "@/components/Providers";

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

export const metadata: Metadata = {
  title: "PhotoMagic",
  description: "Upload, arrange, and download listing photo sequences.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "PhotoMagic",
    description: "Listing photo management for Atlanta Fine Homes",
    url: "https://photomagic.atlantafinehomes.com",
    siteName: "PhotoMagic",
    images: [
      {
        url: "https://photomagic.atlantafinehomes.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "PhotoMagic - Atlanta Fine Homes Sotheby's International Realty",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
