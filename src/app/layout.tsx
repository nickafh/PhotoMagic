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
