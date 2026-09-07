"use client";

import { DipsAuthRequiredClientError, AppSessionExpiredClientError } from "@/lib/api/dips";
import { DipsAuthPrompt } from "@/components/flight/DipsAuthPrompt";
import { AppSessionExpiredPrompt } from "@/components/flight/AppSessionExpiredPrompt";

interface DipsRouteErrorMessageProps {
  error: unknown;
  /** error が DipsAuthRequiredClientError/AppSessionExpiredClientError のいずれでもない場合に表示する既定メッセージ */
  fallbackMessage: string;
}

/**
 * DIPS 連携 API 呼び出しのエラー表示 (DipsAuthRequiredClientError → DIPS ログイン誘導 /
 * AppSessionExpiredClientError → アプリセッション切れ誘導 / それ以外 → 汎用エラー文言の
 * 3分岐)。
 *
 * `DipsFlightPlanSearchPanel.tsx` / `DipsFlightProhibitedAreaSearchPanel.tsx` の
 * `SearchError` と `DipsPermissionApplyPanel.tsx` の `ApplyError` が、3分岐の構造も
 * className も同一のまま複製されていたため (2026-09-06 レビュー I7)、ここへ1本化する。
 * 差分は「それ以外」分岐のフォールバック文言のみで、呼び出し側が `fallbackMessage` で渡す。
 */
export function DipsRouteErrorMessage({ error, fallbackMessage }: DipsRouteErrorMessageProps) {
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
      {error instanceof Error ? error.message : fallbackMessage}
    </p>
  );
}
