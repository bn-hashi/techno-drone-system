"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { postIssueCertificate } from "@/lib/api/adminCertificate";

interface IssueCertificateButtonProps {
  userId: string;
}

// 発行後にコンポーネントは canIssue=false で unmount されるため、
// warning は URL クエリパラメータ経由で親 Server Component に渡し、
// 再レンダー後も表示し続けられるようにする
const WARN_PARAM_KEY = "warn";
const WARN_VALUE_PDF_FAILED = "pdf_failed";
const WARN_VALUE_MAIL_FAILED = "mail_failed";

export function IssueCertificateButton({ userId }: IssueCertificateButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIssue = async () => {
    if (isPending) return;
    if (!window.confirm("修了証明書を発行しますか? 発行後のキャンセルはできません。")) {
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      const response = await postIssueCertificate(userId);
      const warnCodes: string[] = [];
      if (!response.pdfGenerated) {
        warnCodes.push(WARN_VALUE_PDF_FAILED);
      }
      if (!response.mailSent) {
        warnCodes.push(WARN_VALUE_MAIL_FAILED);
      }
      if (warnCodes.length > 0) {
        const params = new URLSearchParams();
        for (const code of warnCodes) {
          params.append(WARN_PARAM_KEY, code);
        }
        router.replace(`${pathname}?${params.toString()}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "発行に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleIssue}
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isPending ? "発行中..." : "修了証明書を発行"}
      </button>
      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
