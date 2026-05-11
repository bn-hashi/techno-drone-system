export function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"
    />
  );
}
