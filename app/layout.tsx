import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import {
  APP_ROBOTS,
  SEO_DESCRIPTION,
  SEO_NAME,
  SEO_SHORT_DESCRIPTION,
} from "@/lib/seo";
import { cn } from "@/lib/utils";
import { PwaRegister } from "@/components/app/pwa-register";

/** Platform typeface — thin / sleek product UI (display 200–300, body 400). */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  // Render-blocking CSS already loads Geist via @font-face. The extra
  // React preload hint is injected after hydration in dev, so Chrome
  // reports the woff2 as preloaded but unused.
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SEO_NAME,
    template: "%s · Cubicle",
  },
  description: SEO_DESCRIPTION,
  applicationName: SEO_NAME,
  category: "education",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/pwa-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: SEO_NAME,
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  // Default: the signed-in app is private. /login, /about, /legal override.
  robots: APP_ROBOTS,
  openGraph: {
    title: SEO_NAME,
    description: SEO_SHORT_DESCRIPTION,
    url: SITE_ORIGIN,
    siteName: SEO_NAME,
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_NAME,
    description: SEO_SHORT_DESCRIPTION,
  },
};

/** Fluid on every display — phones, tablets, desktops, notched devices. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f2f7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full font-sans", geist.className, geist.variable)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="flex min-h-dvh w-full flex-col overflow-x-clip"
        suppressHydrationWarning
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
