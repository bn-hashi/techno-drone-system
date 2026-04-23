import { CreateUserForm } from "@/components/admin/CreateUserForm";

export const metadata = { title: "受講者新規登録" };

export default function AdminUsersNewPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">受講者新規登録</h1>
      <div className="max-w-md">
        <CreateUserForm />
      </div>
    </div>
  );
}
