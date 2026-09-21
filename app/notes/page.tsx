import { authenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotesPage } from "@/components/notes/notes-page";
export default async function Page() {
  if (!(await authenticated())) redirect("/login");
  return <NotesPage />;
}
