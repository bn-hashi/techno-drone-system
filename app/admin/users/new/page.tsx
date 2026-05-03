import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { UserRole } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "受講者新規登録" };

export default async function AdminUsersNewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">受講者新規登録</h1>
      <div className="max-w-md">
        <CreateUserForm />
      </div>
    </div>
  );
}
