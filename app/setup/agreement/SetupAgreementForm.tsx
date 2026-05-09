"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AGREEMENT_TEXT } from "@/lib/constants/agreementText";
import { Button } from "@/components/ui/Button";

export function SetupAgreementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!agreed) {
      setError("規約に同意するにはチェックを入れてください");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/setup/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "エラーが発生しました");
        return;
      }

      router.push("/login?registered=1");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-white rounded-lg shadow p-8 max-w-2xl w-full">
        <p className="text-red-600 text-sm">無効なリンクです。招待メールのリンクを再度ご確認ください。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-8 max-w-2xl w-full">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">受講規約への同意</h1>
      <p className="text-sm text-gray-600 mb-4">
        下記の受講規約をよくお読みのうえ、同意してください。
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 h-64 overflow-y-auto mb-6">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {AGREEMENT_TEXT}
        </pre>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            受講規約を読み、内容に同意します
          </span>
        </label>

        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} disabled={!agreed}>
          同意して本登録を完了する
        </Button>
      </form>
    </div>
  );
}
