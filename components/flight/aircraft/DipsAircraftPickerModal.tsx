"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  fetchDipsOwnedAircrafts,
  dipsLoginUrl,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";
import { dipsUaStatusLabel, dipsDeregistrationReasonLabel, dipsUaStatusBadgeVariant } from "@/lib/constants/dipsAircraftStatus";

interface DipsAircraftPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 選択可能な機体 (isSelectable=true) が選ばれたときに呼ばれる */
  onSelect: (aircraft: DipsOwnedAircraftDto) => void;
  /** DIPS 未連携時のログイン誘導で、連携完了後に戻ってくるページのパス */
  returnPath?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; aircrafts: DipsOwnedAircraftDto[]; excludedCount: number }
  | { status: "authRequired"; realm: string }
  | { status: "sessionExpired" }
  | { status: "error"; message: string };

/** 機体の状態ラベル (抹消済みは抹消理由を併記する)。未知コードは「不明」と表示する */
function statusLabel(aircraft: DipsOwnedAircraftDto): string {
  const base = dipsUaStatusLabel(aircraft.status);
  // deregistrationReason は 0 を取りうるコード値ではないが、falsy-zero (`0 && ...` が
  // 数字の 0 を描画してしまう) を避けるため null との比較で判定する
  if (aircraft.deregistrationReason !== null) {
    return `${base} (${dipsDeregistrationReasonLabel(aircraft.deregistrationReason)})`;
  }
  return base;
}

/**
 * DIPS ログイン済みアカウントが所有する機体を一覧表示し、1機を選択できるモーダル。
 * 機体フォームの「DIPSから取り込む」ボタンから開く。所有者・使用者の情報は表示しない。
 *
 * ADMIN が代理登録する場合でも、DIPS へログインしたアカウント (= 自分自身) が所有する
 * 機体しか取得できない (DIPS 側の仕様上の制約)。この旨は画面上にも案内文として表示する
 * (`DipsVerifyButton.tsx` の案内文と文言を揃えている)。
 *
 * データ取得は `useEffect` + `fetchDipsOwnedAircrafts` の手書き実装のままにしている
 * (2026-08-10 差し戻しで検討: `.claude/rules/frontend.md` は Client Component からの
 * データ取得に TanStack Query を使う方針だが、本コンポーネントは同じ差し戻しで
 * falsy-zero 修正・ステータス表示の一元化・除外件数の伝搬・セッション切れ導線・
 * レスポンス形状の変更を同時に加えており、これに TanStack Query への移行まで重ねると
 * QueryClientProvider を前提にしたテストの全面書き換えが必要になり回帰リスクが
 * 積み上がる。機能的な利点がない純粋なリファクタのため今回は見送り、builder 報告書に
 * 未対応の指摘として理由を残す)。
 */
export function DipsAircraftPickerModal({
  isOpen,
  onClose,
  onSelect,
  returnPath,
}: DipsAircraftPickerModalProps) {
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetchDipsOwnedAircrafts(includeInvalid)
      .then(({ aircrafts, excludedCount }) => {
        if (!cancelled) setState({ status: "loaded", aircrafts, excludedCount });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DipsAuthRequiredClientError) {
          setState({ status: "authRequired", realm: err.realm });
          return;
        }
        if (err instanceof AppSessionExpiredClientError) {
          setState({ status: "sessionExpired" });
          return;
        }
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "DIPS機体情報の取得に失敗しました",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, includeInvalid]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DIPSから機体を取り込む">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          DIPSにログインしたアカウントが所有する機体のみ表示されます
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInvalid}
            onChange={(e) => setIncludeInvalid(e.target.checked)}
          />
          無効な機体も表示
        </label>

        {state.status === "loading" && <p className="text-sm text-gray-500">読み込み中...</p>}

        {state.status === "authRequired" && (
          <p className="text-sm text-gray-700">
            DIPSへのログインが必要です。
            <a
              href={dipsLoginUrl(state.realm, returnPath)}
              className="ml-1 text-blue-600 hover:underline"
            >
              DIPSにログインする
            </a>
          </p>
        )}

        {state.status === "sessionExpired" && (
          <p className="text-sm text-gray-700">
            ログインが必要です。再度ログインしてください。
            <a href="/login" className="ml-1 text-blue-600 hover:underline">
              ログイン画面へ
            </a>
          </p>
        )}

        {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}

        {state.status === "loaded" && state.excludedCount > 0 && (
          <p className="text-sm text-amber-700">
            {state.excludedCount}件の機体情報を読み込めませんでした。表示されている機体以外にも
            所有機体がある可能性があります。解消しない場合はサポートへお問い合わせください
          </p>
        )}

        {state.status === "loaded" && state.aircrafts.length === 0 && (
          <p className="text-sm text-gray-500">DIPSに登録された機体がありません</p>
        )}

        {state.status === "loaded" && state.aircrafts.length > 0 && (
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
            {state.aircrafts.map((aircraft) => (
              <li key={aircraft.registrationCode} className="py-2">
                <button
                  type="button"
                  disabled={!aircraft.isSelectable}
                  onClick={() => onSelect(aircraft)}
                  className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="text-sm">
                    <span className="font-mono">{aircraft.registrationCode}</span>
                    <span className="ml-2 text-gray-500">
                      {aircraft.manufacturer} {aircraft.modelNumber}
                    </span>
                  </span>
                  <Badge variant={dipsUaStatusBadgeVariant(aircraft.status)}>
                    {statusLabel(aircraft)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
