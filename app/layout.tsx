import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Platform typeface — thin / sleek product UI (display 200–300, body 400). */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Cubicle",
    template: "%s · Cubicle",
  },
  description:
    "School laptop cart scheduling for authorized staff. Google sign-in for @rbe.sk.ca allowlisted accounts only.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Cubicle",
    description:
      "Book laptop carts by period. Authorized school staff only.",
    url: SITE_ORIGIN,
    siteName: "Cubicle",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "font-sans", geist.variable)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
