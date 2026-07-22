import { redirect } from "next/navigation";

/** Password reset is unused — staff authenticate with Google. */
export default function ResetPasswordPage() {
  redirect("/login");
}
