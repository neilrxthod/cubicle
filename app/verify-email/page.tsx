import { redirect } from "next/navigation";

/** Email verification flow is unused — Google provides verified school accounts. */
export default function VerifyEmailPage() {
  redirect("/login");
}
