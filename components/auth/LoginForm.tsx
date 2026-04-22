"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

interface LoginFormProps {
  onSubmit?: () => void;
}

// After a successful Credentials sign-in, this route handler reads the JWT role
// and redirects to the correct dashboard (/admin or /student).
const ROLE_REDIRECT_PATH = "/auth/role-redirect";

// エラーコードをユーザー向けメッセージに変換する
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "メールアドレスまたはパスワードが正しくありません。",
  account_not_active: "アカウント登録が完了していません。",
  account_pending: "本登録メールをご確認ください。",
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // redirect: false → next-auth returns undefined on success (after setting
      // window.location.href = callbackUrl) and returns { error } on failure.
      // This avoids next-auth/react issuing GET /api/auth/signin?csrf=true which
      // occurs with redirect: true and can interfere with the CSRF cookie flow.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: ROLE_REDIRECT_PATH,
      });

      // FAILURE: result contains { error, ok: false }.
      if (result?.error) {
        const message =
          LOGIN_ERROR_MESSAGES[result.error] ?? "ログインに失敗しました。もう一度お試しください。";
        setError(message);
        return;
      }

      // SUCCESS: next-auth set the session cookie in the POST response.
      // Navigate via window.location.href for a full page load so the
      // role-redirect route handler can read the JWT cookie and redirect
      // to /admin or /student.
      window.location.href = result?.url ?? ROLE_REDIRECT_PATH;
      if (onSubmit) onSubmit();
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          disabled={isLoading}
          data-testid="email-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          disabled={isLoading}
          data-testid="password-input"
        />
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
          data-testid="login-error"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
        data-testid="login-submit"
      >
        {isLoading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
