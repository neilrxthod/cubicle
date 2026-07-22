import { redirect } from "next/navigation";

/** Public signup is disabled — school Google + IT allowlist only. */
export default function SignupPage() {
  redirect("/login");
}
