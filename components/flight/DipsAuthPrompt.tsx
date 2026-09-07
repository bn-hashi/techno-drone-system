import { dipsLoginUrl } from "@/lib/api/dips";

interface DipsAuthPromptProps {
  /** DipsAuthRequiredClientError.realm。ログイン誘導リンクの realm クエリに使う */
  realm: string;
  /** 連携完了後に戻ってくるページのパス (省略時は `dipsLoginUrl` の既定に従う) */
  returnPath?: string;
  /** 呼び出し元ごとの余白差分を吸収する (既定値は DipsAircraftPickerModal.tsx の値) */
  className?: string;
  /**
   * `DipsPermissionsPanel.tsx` のみ非同期結果の更新をスクリーンリーダーへ通知するため
   * `role="status"` を付与する。他の呼び出し元 (DipsAircraftPickerModal.tsx /
   * DipsVerifyButton.tsx) は付けない (既存の挙動を維持する)
   */
  role?: "status";
  ariaLive?: "polite";
}

/**
 * DIPS へのログインが必要なときの案内文。
 *
 * `DipsAircraftPickerModal.tsx` / `DipsVerifyButton.tsx` / `DipsPermissionsPanel.tsx` の
 * 3箇所で、文言・リンクのクラス・`dipsLoginUrl` の呼び方まで完全に同一だったため
 * (2026-08-28 段階2共通化)、ここへ1本化する。呼び出し元ごとに異なるのは外側の `<p>` の
 * 余白クラスと role/aria-live の有無のみで、いずれも props で吸収する。
 */
export function DipsAuthPrompt({
  realm,
  returnPath,
  className = "text-sm text-gray-700",
  role,
  ariaLive,
}: DipsAuthPromptProps) {
  return (
    <p className={className} role={role} aria-live={ariaLive}>
      DIPSへのログインが必要です。
      <a href={dipsLoginUrl(realm, returnPath)} className="ml-1 text-blue-600 hover:underline">
        DIPSにログインする
      </a>
    </p>
  );
}
