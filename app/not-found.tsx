export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">404 - ページが見つかりません</h1>
      <p className="text-gray-600">お探しのページは存在しないか、移動された可能性があります。</p>
    </main>
  );
}
