import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">ドローンスクール 学科オンライン講座</h1>
      <p className="text-gray-600 mb-8">二等無人航空機操縦士 学科試験対策</p>
      <Link
        href="/auth/signin"
        className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
      >
        ログイン
      </Link>
    </main>
  );
}
