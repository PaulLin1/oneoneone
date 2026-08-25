import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Masthead } from "@/components/Masthead";
import { Footer } from "@/components/Footer";
import "./globals.css";

const literarySerif = Newsreader({
  variable: "--font-literary-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "oneoneone — one poem, one essay, one story",
  description:
    "A daily set of three public-domain texts: one poem, one essay, one short story, the same for every reader.",
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
