import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { SITE_ORIGIN } from "@/lib/site";
import { cn } from "@/lib/utils";
import { PwaRegister } from "@/components/app/pwa-register";

/** Platform typeface — thin / sleek product UI (display 200–300, body 400). */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Cubicle",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
      className={cn("h-full font-sans", geist.variable)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={cn(
          geist.className,
          "flex min-h-dvh w-full flex-col overflow-x-clip",
        )}
        suppressHydrationWarning
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
