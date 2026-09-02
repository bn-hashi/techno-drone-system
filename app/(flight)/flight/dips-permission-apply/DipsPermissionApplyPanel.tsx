"use client";

import { useMutation } from "@tanstack/react-query";
import {
  applyDipsPermissionTest,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import { DipsAuthPrompt } from "@/components/flight/DipsAuthPrompt";
import { AppSessionExpiredPrompt } from "@/components/flight/AppSessionExpiredPrompt";

function ApplyError({ error }: { error: unknown }) {
  if (error instanceof DipsAuthRequiredClientError) {
    return (
      <DipsAuthPrompt
        realm={error.realm}
        returnPath={typeof window !== "undefined" ? window.location.pathname : undefined}
        className="mt-4 text-sm text-gray-700"
        role="status"
        ariaLive="polite"
      />
    );
  }
  if (error instanceof AppSessionExpiredClientError) {
    return (
      <AppSessionExpiredPrompt className="mt-4 text-sm text-gray-700" role="status" ariaLive="polite" />
    );
  }
  return (
    <p className="mt-4 text-sm text-red-600" role="alert">
      {error instanceof Error ? error.message : "DIPS許可・承認申請の送信に失敗しました"}
    </p>
  );
}

/**
 * 許可・承認申請受付 API (5-3) の疎通確認パネル。
 *
 * 5-3 は検証環境で任意の申請を送信し、申請受付番号が取得できることを確認するのが目的
 * (設定通知書「検証環境での確認ポイント」D35/E35)。申請内容はサーバー側
 * (`buildPermissionApplicationTestPayload`) がガイドライン準拠で組み立てて送信するため、
 * このパネルは入力フォームを持たず、ボタン1つで送信する (依頼書の「疎通確認が目的なので
 * 最小限でよい」に対応)。
 *
 * ⚠️ 検証環境の他事業者共用データベースへ実際に申請データを登録する操作のため、
 * `DipsFlightProhibitedAreaSearchPanel` 等と同じく「ボタンを押す = DIPS を1回呼ぶ」の
 * 契約を守る (自動送信・自動再送信は行わない)。
 */
export function DipsPermissionApplyPanel() {
  const mutation = useMutation({
    mutationFn: applyDipsPermissionTest,
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {mutation.isPending ? "送信中..." : "テスト申請を送信"}
      </button>
      <p className="mt-1 text-xs text-gray-500">
        ガイドライン準拠の固定テスト内容 (東京都・型式認証機体) で許可・承認申請を送信します
      </p>

      {mutation.isError && <ApplyError error={mutation.error} />}
      {mutation.isSuccess && (
        <p className="mt-4 text-sm text-gray-900" role="status" aria-live="polite">
          申請受付番号: {mutation.data.formNum}
        </p>
      )}
    </div>
  );
}
