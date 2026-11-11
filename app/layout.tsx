import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Stakeholder Profile กยท.", template: "%s · Stakeholder Profile กยท." },
  description: "ระบบฐานข้อมูลผู้มีส่วนได้ส่วนเสียของการยางแห่งประเทศไทย",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#168151" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
