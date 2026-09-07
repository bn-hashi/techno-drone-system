"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { applyDipsPermissionTest } from "@/lib/api/dips";
import { DipsRouteErrorMessage } from "@/components/flight/DipsRouteErrorMessage";

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
 *
 * I2 対応 (2026-09-06 レビュー): 送信は成功後すぐ再活性化するボタンしかなく、確認
 * ステップも成功後のロックも無かったため、2回押すと共用DBに2件登録される実害があった。
 * - 確認ステップ: `window.confirm`/`alert` は使わず、インラインの確認表示 (「送信する」/
 *   「キャンセル」の2ボタン) を挟む
 * - 成功後のロック: 送信系のボタンを一切表示せず「送信済み（受付番号 …）」表示に固定し、
 *   再送するにはページの再読み込みを要求する (`useMutation` の状態はページ内に留まる
 *   ため、リロードでのみ解除できるようにすることで誤操作での再送を防ぐ)
 */
export function DipsPermissionApplyPanel() {
  const [isConfirming, setIsConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: applyDipsPermissionTest,
  });

  const handleConfirm = () => {
    // 確認パネル (「送信中...」の非活性ボタン) は送信中も表示し続ける必要があるため、
    // isConfirming はここで即座に false へは戻さず、送信が完了 (成功/失敗いずれか) して
    // から戻す。失敗時は確認パネルを閉じ、初期状態に戻すことで再送には必ず「テスト申請を
    // 送信」からの再確認を要求する (安全側の挙動)。成功時はこの下の isSuccess 分岐が
    // 常に優先されるため、isConfirming の値は表示に影響しない。
    mutation.mutate(undefined, {
      onSettled: () => setIsConfirming(false),
    });
  };

  if (mutation.isSuccess) {
    return (
      <div>
        <p className="text-sm text-gray-900" role="status" aria-live="polite">
          送信済み（受付番号: {mutation.data.formNum}）
        </p>
        <p className="mt-1 text-xs text-gray-500">
          再送するにはこのページを再読み込みしてください
        </p>
      </div>
    );
  }

  return (
    <div>
      {!isConfirming && (
        <>
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            テスト申請を送信
          </button>
          <p className="mt-1 text-xs text-gray-500">
            ガイドライン準拠の固定テスト内容 (東京都・型式認証機体) で許可・承認申請を送信します
          </p>
        </>
      )}

      {isConfirming && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="text-gray-900">
            検証環境の他事業者共用データベースに実際の申請データが登録されます。送信しますか？
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "送信中..." : "送信する"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={mutation.isPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {mutation.isError && (
        <DipsRouteErrorMessage
          error={mutation.error}
          fallbackMessage="DIPS許可・承認申請の送信に失敗しました"
        />
      )}
    </div>
  );
}
