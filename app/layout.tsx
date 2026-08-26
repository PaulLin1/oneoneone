import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Masthead } from "@/components/Masthead";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const literarySerif = Newsreader({
  variable: "--font-literary-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const TITLE = "oneoneone — one poem, one essay, one story";
const DESCRIPTION =
  "A daily set of three public-domain texts: one poem, one essay, one short story, the same for every reader.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "oneoneone",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#f1eb2b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${literarySerif.variable} h-dvh antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden bg-paper text-ink font-sans">
        <Masthead />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
