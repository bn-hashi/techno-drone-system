import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EnrollmentForm } from "@/components/admin/EnrollmentForm";
import { UserRole } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "入学申請登録" };

interface PageProps {
  searchParams: { userId?: string };
}

export default async function EnrollmentNewPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const { userId } = searchParams;
  // Prisma の cuid 形式を検証し、不正な値によるリクエストを弾く
  const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{10,50}$/;
  if (!userId || !VALID_ID_PATTERN.test(userId)) {
    redirect("/admin/users");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <a href="/admin/users" className="text-sm text-blue-600 hover:underline">
          ← 受講者一覧に戻る
        </a>
        <h1 className="mt-2 text-2xl font-bold">入学申請登録</h1>
      </div>

      <div className="max-w-lg">
        <EnrollmentForm userId={userId} />
      </div>
    </div>
  );
}
