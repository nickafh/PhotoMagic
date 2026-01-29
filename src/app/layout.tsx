import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
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
          inter.className,
          "bg-background-light dark:bg-background-dark",
          "text-slate-900 dark:text-slate-100",
          "min-h-screen",
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}