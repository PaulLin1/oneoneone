import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Masthead } from "@/components/Masthead";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Runs before hydration (strategy="beforeInteractive" — Next.js hoists this
// into <head> regardless of where it's declared) so the .dark class is on
// <html> before first paint; without it, a dark-mode visitor would see a
// flash of the light theme on every load. suppressHydrationWarning on
// <html> below is required because of this — React's server-rendered HTML
// never has the class, only what this script adds client-side.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

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
    <html lang="en" className={`${literarySerif.variable} h-dvh antialiased`} suppressHydrationWarning>
      <body className="flex h-dvh flex-col overflow-hidden bg-paper text-ink font-sans">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Masthead />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
