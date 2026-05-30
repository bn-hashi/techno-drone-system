"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postIssueCertificate } from "@/lib/api/adminCertificate";

interface IssueCertificateButtonProps {
  userId: string;
}

export function IssueCertificateButton({ userId }: IssueCertificateButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleIssue = async () => {
    if (isPending) return;
    if (!window.confirm("修了証明書を発行しますか? 発行後のキャンセルはできません。")) {
      return;
    }
    setIsPending(true);
    setError(null);
    setWarning(null);
    try {
      const response = await postIssueCertificate(userId);
      const warnings: string[] = [];
      if (!response.pdfGenerated) {
        warnings.push("PDF の生成に失敗しました。再発行はできません。事務局に確認してください。");
      }
      if (!response.mailSent) {
        warnings.push("受講者へのメール通知に失敗しました。");
      }
      if (warnings.length > 0) {
        setWarning(warnings.join(" "));
      }
      router.refresh();
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
      {warning !== null && (
        <p role="status" className="mt-2 text-xs text-amber-700">
          {warning}
        </p>
      )}
    </div>
  );
}
