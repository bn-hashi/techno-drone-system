"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface InviteButtonProps {
  studentId: string;
}

export function InviteButton({ studentId }: InviteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/students/${studentId}/invite`, {
        method: "POST",
      });

      if (response.ok) {
        setMessage({ type: "success", text: "招待メールを送信しました" });
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: (data as { error?: string }).error ?? "送信に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} isLoading={isLoading}>
        招待メールを送信
      </Button>
      {message && (
        <p
          role="status"
          className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
