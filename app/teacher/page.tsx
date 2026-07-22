import { redirect } from "next/navigation";

/** Legacy route — teachers now land on the shared home board. */
export default function TeacherRedirectPage() {
  redirect("/");
}
