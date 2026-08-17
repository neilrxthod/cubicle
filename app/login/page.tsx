import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/auth-clients";
import { JsonLd } from "@/components/seo/json-ld";
import {
  publicPageMetadata,
  SEO_DESCRIPTION,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Sign in",
  description: SEO_DESCRIPTION,
  path: "/login",
});

export default function LoginPage() {
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">
        Cubicle — laptop cart scheduling for authorized school staff. Sign in
        with your school Google account.
      </h1>
      <LoginClient />
    </>
  );
}
