import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./design.css";
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
// Old addresses (merkelapp.vercel.app) send the browser on to the same page on jobbverktoy.no. The portal fetches
// pages from merkelapp.vercel.app, but the browser then shows jobbverktoy.no, so it never loops. API calls are untouched.
const OLD_HOSTS = ["merkelapp.vercel.app", "merkelapp-ole93.vercel.app", "merkelapp-git-main-ole93.vercel.app"];
const toPortal = `(function(){var l=location;if(${JSON.stringify(OLD_HOSTS)}.indexOf(l.hostname)<0)return;var p=l.pathname.indexOf("/merkelapp")===0?l.pathname:"/merkelapp"+(l.pathname==="/"?"":l.pathname);l.replace("https://jobbverktoy.no"+p+l.search+l.hash)})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body><script dangerouslySetInnerHTML={{ __html: toPortal }} />{children}</body>
    </html>
  );
}
