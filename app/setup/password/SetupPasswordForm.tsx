"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// パスワードポリシー: 8文字以上 + 大文字1文字以上 + 数字1文字以上
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      setError("パスワードは8文字以上で、大文字と数字をそれぞれ1文字以上含む必要があります");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/setup/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "エラーが発生しました");
        return;
      }

      sessionStorage.setItem("setup_token", token);
      router.push("/setup/agreement");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
        <p className="text-red-600 text-sm">
          無効なリンクです。招待メールのリンクを再度ご確認ください。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">パスワードの設定</h1>
      <p className="text-sm text-gray-600 mb-6">
        ドローンスクールへようこそ。初回ログイン用のパスワードを設定してください。
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8文字以上・大文字・数字を含む"
          required
          autoComplete="new-password"
        />
        <Input
          label="パスワード（確認）"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="もう一度入力してください"
          required
          autoComplete="new-password"
        />

        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} className="mt-2">
          次へ（規約の確認）
        </Button>
      </form>
    </div>
  );
}
