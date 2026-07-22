import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL("https://mycubicle.app"),
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
    url: "https://mycubicle.app",
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
