import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Merkelapp · Jobbverktøy",
  description: "Skann varer. Tell. Skriv ut tydelige A3-lapper.",
  manifest: "https://jobbverktoy.no/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Jobbverktøy" },
  icons: { apple: "https://jobbverktoy.no/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7f9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
