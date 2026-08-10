"use client";

import { useState } from "react";
import {
  fetchDipsOwnedAircrafts,
  dipsLoginUrl,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";
import { dipsUaStatusLabel, dipsDeregistrationReasonLabel } from "@/lib/constants/dipsAircraftStatus";

interface DipsVerifyButtonProps {
  registrationNumber: string | null;
}

type VerifyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; aircraft: DipsOwnedAircraftDto }
  | { status: "notFound" }
  | { status: "authRequired"; realm: string }
  | { status: "sessionExpired" }
  | { status: "error"; message: string };

function formatValidPeriodEnd(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/**
 * 機体詳細ページの「DIPSと照合」ボタン。
 * DIPS の機体情報一覧取得 API を都度呼び出し、この機体の登録記号に一致する DIPS 上の
 * ステータス・有効期限を表示するだけで、DB には一切保存しない (第1段階の決定)。
 */
export function DipsVerifyButton({ registrationNumber }: DipsVerifyButtonProps) {
  const [state, setState] = useState<VerifyState>({ status: "idle" });

  if (!registrationNumber) {
    return <p className="text-sm text-gray-500">登録記号が未設定のためDIPSと照合できません</p>;
  }

  const handleVerify = async () => {
    setState({ status: "loading" });
    try {
      // 抹消済み・期限切れの状態も確認したいため includeInvalid=true で取得する
      const { aircrafts } = await fetchDipsOwnedAircrafts(true);
      const matched = aircrafts.find((a) => a.registrationCode === registrationNumber);
      setState(matched ? { status: "found", aircraft: matched } : { status: "notFound" });
    } catch (err) {
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
        message: err instanceof Error ? err.message : "DIPSとの照合に失敗しました",
      });
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleVerify}
        disabled={state.status === "loading"}
        className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {state.status === "loading" ? "照合中..." : "DIPSと照合"}
      </button>
      <p className="mt-1 text-xs text-gray-500">
        DIPSにログインしたアカウントが所有する機体のみ照合できます
      </p>

      {state.status === "found" && (
        <p className="mt-2 text-sm text-gray-700">
          DIPS上のステータス: {dipsUaStatusLabel(state.aircraft.status)}
          {/* deregistrationReason は falsy-zero (`0 && ...` が数字の 0 を描画してしまう) を
              避けるため null との比較で判定する */}
          {state.aircraft.deregistrationReason !== null &&
            ` (${dipsDeregistrationReasonLabel(state.aircraft.deregistrationReason)})`}
          ・有効期限: {formatValidPeriodEnd(state.aircraft.validPeriodEnd)}
        </p>
      )}

      {state.status === "notFound" && (
        <p className="mt-2 text-sm text-gray-500">
          DIPS上に該当する機体が見つかりませんでした
        </p>
      )}

      {state.status === "authRequired" && (
        <p className="mt-2 text-sm text-gray-700">
          DIPSへのログインが必要です。
          <a
            href={dipsLoginUrl(
              state.realm,
              typeof window !== "undefined" ? window.location.pathname : undefined
            )}
            className="ml-1 text-blue-600 hover:underline"
          >
            DIPSにログインする
          </a>
        </p>
      )}

      {state.status === "sessionExpired" && (
        <p className="mt-2 text-sm text-gray-700">
          ログインが必要です。再度ログインしてください。
          <a href="/login" className="ml-1 text-blue-600 hover:underline">
            ログイン画面へ
          </a>
        </p>
      )}

      {state.status === "error" && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
    </div>
  );
}
