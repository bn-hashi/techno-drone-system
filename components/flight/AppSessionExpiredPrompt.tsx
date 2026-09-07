interface AppSessionExpiredPromptProps {
  /** 呼び出し元ごとの余白差分を吸収する (既定値は DipsAircraftPickerModal.tsx の値) */
  className?: string;
  /**
   * `DipsPermissionsPanel.tsx` のみ非同期結果の更新をスクリーンリーダーへ通知するため
   * `role="status"` を付与する。他の呼び出し元は付けない (既存の挙動を維持する)
   */
  role?: "status";
  ariaLive?: "polite";
}

/**
 * アプリ自体のログインセッションが失効しているときの案内文 (DIPS 側の再認可とは別物)。
 *
 * `DipsAircraftPickerModal.tsx` / `DipsVerifyButton.tsx` / `DipsPermissionsPanel.tsx` の
 * 3箇所で文言・リンクのクラスが完全に同一だったため (2026-08-28 段階2共通化)、
 * `DipsAuthPrompt` と対になる形でここへ1本化する。
 */
export function AppSessionExpiredPrompt({
  className = "text-sm text-gray-700",
  role,
  ariaLive,
}: AppSessionExpiredPromptProps) {
  return (
    <p className={className} role={role} aria-live={ariaLive}>
      ログインが必要です。再度ログインしてください。
      <a href="/login" className="ml-1 text-blue-600 hover:underline">
        ログイン画面へ
      </a>
    </p>
  );
}
