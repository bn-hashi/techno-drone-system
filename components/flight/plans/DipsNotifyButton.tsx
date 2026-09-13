"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { notifyFlightPlanToDips, dipsLoginUrl, DipsAuthRequiredClientError } from "@/lib/api/dips";
import type { DipsNotificationInput, DipsNotificationResult } from "@/lib/api/dips";
import { DipsNotifyForm, INITIAL_FORM, validateAndBuildInput } from "./DipsNotifyForm";
import type { FormState } from "./DipsNotifyForm";

interface DipsNotifyButtonProps {
  planId: string;
  /** 通報済みなら DIPS 採番の飛行計画 ID。未通報は null */
  dipsFlightPlanId: string | null;
  /**
   * 飛行予定日時が古すぎて通報できない見込みか (2026-09-11 req-014 課題3, H-5)。
   * サーバー側検証 (services/dipsService.ts の isNotifiableStartTime) が必須の判定であり、
   * これは送信前にボタンを無効化する UX 改善に過ぎない (サーバー側の再検証を省略しない)。
   * 呼び出し元 (Server Component) がレンダー時点の判定済み boolean を渡す (クライアント側で
   * new Date() を評価すると SSR とのハイドレーション不一致を起こしうるため)。省略時は false
   * (無効化しない)。
   */
  isPastNotifiableWindow?: boolean;
}

/** DIPS ログイン遷移でページを離れる間、フォーム入力を退避する sessionStorage キー */
const PENDING_NOTIFY_STORAGE_KEY = "dips:pendingNotifyForm";

interface PendingNotifyState {
  planId: string;
  form: FormState;
}

interface BannerState {
  type: "success" | "error";
  message: string;
}

/** 退避済みフォームを読み出す。この計画のものでない・壊れている場合は null */
function loadPendingNotifyForm(planId: string): FormState | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_NOTIFY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingNotifyState> | null;
    if (parsed?.planId !== planId || typeof parsed.form !== "object" || parsed.form === null) {
      return null;
    }
    // 将来 FormState の項目が変わっても壊れないよう、既定値にマージする
    return { ...INITIAL_FORM, ...parsed.form };
  } catch {
    return null;
  }
}

/** フォーム入力を退避する。sessionStorage が使えない環境では何もしない */
function savePendingNotifyForm(planId: string, form: FormState): void {
  try {
    const state: PendingNotifyState = { planId, form };
    window.sessionStorage.setItem(PENDING_NOTIFY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // プライベートモード等で保存できない場合、復元なしでログインへ進む
  }
}

/**
 * 検証済み入力で DIPS 通報 API を呼び出す共通シーケンス。
 * resubmitAfterDipsLink (自動再送信) と handleSubmit (手動送信) はこの
 * API 呼び出し自体は同一だが、成功時・失敗時の振る舞い（バナー表示・
 * ログイン誘導の有無など）が異なるため、それぞれコールバックに委ねる。
 *
 * onSuccess にレスポンス (result) を渡す (2026-09-11 req-014 課題1: 他の飛行経路との
 * 重複件数 (existOtherFlightRoutesCount) を送信直後に一度だけ表示するため。DB には
 * 保存しない一時的な表示であり、この呼び出し以外に取得手段がないため result をここで
 * 受け渡す必要がある)。
 */
async function sendDipsNotification(
  targetPlanId: string,
  input: DipsNotificationInput,
  onSuccess: (result: DipsNotificationResult) => void,
  onError: (err: unknown) => void
): Promise<void> {
  try {
    const result = await notifyFlightPlanToDips(targetPlanId, input);
    onSuccess(result);
  } catch (err) {
    onError(err);
  }
}

/** 他の飛行経路との重複件数を、通報直後に一度だけ表示するための案内文を組み立てる */
function buildDuplicateRouteNotice(existOtherFlightRoutesCount: number | null): string | null {
  // null と undefined の両方を弾く (2026-09-11 /code-review 指摘4)。クライアント境界
  // (lib/api/dips.ts) で result の形を再検証していないため、将来 existOtherFlightRoutesCount
  // が欠けた body が来ると undefined になりうる。`=== null` のみだと undefined がすり抜け、
  // `undefined <= 0` は false (NaN比較) のため「他の飛行経路と undefined 件重複しています」
  // を表示してしまう (プロジェクト規約の `===`/`!==` 徹底 (eqeqeq) を保ちつつ両方を弾く)
  if (
    existOtherFlightRoutesCount === null ||
    existOtherFlightRoutesCount === undefined ||
    existOtherFlightRoutesCount <= 0
  ) {
    return null;
  }
  return `通報が完了しました。他の飛行経路と ${existOtherFlightRoutesCount} 件重複しています。`;
}

export function DipsNotifyButton({
  planId,
  dipsFlightPlanId,
  isPastNotifiableWindow = false,
}: DipsNotifyButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);

  // Escape キーでダイアログを閉じる (アクセシビリティ対応)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  /**
   * OAuth 復帰後、退避していたフォーム内容で通報を自動再送信する。
   * 復元データが不正な場合や再送信が失敗した場合は、ループさせず
   * 手動での再送信 (「通報する」ボタン) を促すバナーに切り替える。
   */
  const resubmitAfterDipsLink = useCallback(
    async (savedForm: FormState): Promise<void> => {
      const validated = validateAndBuildInput(savedForm);
      if (!validated.ok) {
        setBanner({
          type: "error",
          message: `DIPS連携が完了しましたが、復元した入力内容に不備があります (${validated.message})。内容を確認のうえ、再度「通報する」を押してください。`,
        });
        return;
      }

      setIsSubmitting(true);
      setError(null);
      try {
        await sendDipsNotification(
          planId,
          validated.input,
          (result) => {
            setIsOpen(false);
            const duplicateNotice = buildDuplicateRouteNotice(result.existOtherFlightRoutesCount);
            setBanner({
              type: "success",
              message: duplicateNotice
                ? `DIPS連携が完了し、飛行計画の通報を自動で送信しました。${duplicateNotice}`
                : "DIPS連携が完了し、飛行計画の通報を自動で送信しました。",
            });
            router.refresh();
          },
          (err) => {
            // 自動再送信が失敗した場合は、DipsAuthRequiredClientError であっても
            // 再度ログイン画面へは遷移させず (無限ループ防止)、手動操作を促す
            const detail = err instanceof Error ? err.message : "不明なエラー";
            setBanner({
              type: "error",
              message: `DIPS連携が完了しましたが、通報の自動再送信に失敗しました (${detail})。内容を確認のうえ、再度「通報する」を押してください。`,
            });
          }
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [planId, router]
  );

  // DIPS 認可フローから戻ってきたとき (?dips=...) に退避済みフォームを復元し、
  // 連携成功時はそのまま自動で通報を再送信する。
  // sessionStorage の削除をこの effect の先頭 (自動送信の開始前) で行うことで、
  // 同一クエリに対して effect が複数回実行されても savedForm が null になり、
  // 二重送信を防止できる (加えて isSubmitting 中はボタン自体も無効化する)。
  // 復元後に router.replace でクエリを除去するため、この effect は2回目の実行で
  // 早期リターンし、無限ループにはならない。
  //
  // dipsFlightPlanId (既に通報済みか) も併せて確認する。コンポーネント末尾の
  // 早期 return (dipsFlightPlanId 有りなら「DIPS通報済み」表示) は hooks の
  // 呼び出し順より後にあるため、この effect の実行自体は止めない。OAuth 往復中
  // (数十秒〜数分) に別タブ等で先に通報済みになった場合、確認なしに
  // resubmitAfterDipsLink を呼ぶと DIPS へ重複通報してしまう
  // (DipsNotificationInput に flightPlanId がなく、更新ではなく新規通報になる)。
  useEffect(() => {
    const dipsResult = searchParams.get("dips");
    if (!dipsResult) return;

    const savedForm = loadPendingNotifyForm(planId);
    window.sessionStorage.removeItem(PENDING_NOTIFY_STORAGE_KEY);

    if (dipsResult === "linked" && !dipsFlightPlanId) {
      if (savedForm) {
        setForm(savedForm);
        setIsOpen(true);
        setBanner({
          type: "success",
          message: "DIPS連携が完了しました。入力内容を復元し、通報を自動で再送信しています...",
        });
        void resubmitAfterDipsLink(savedForm);
      } else {
        setBanner({ type: "success", message: "DIPS連携が完了しました。" });
      }
    } else if (dipsResult !== "linked") {
      // 失敗時も入力は復元し、再入力の手間を減らす (モーダルは自動で開かない)
      if (savedForm) setForm(savedForm);
      setBanner({
        type: "error",
        message:
          dipsResult === "state_error"
            ? "DIPS連携の検証に失敗しました。もう一度お試しください。"
            : "DIPS連携に失敗しました。もう一度お試しください。",
      });
    }
    // dipsResult === "linked" && dipsFlightPlanId (別タブ等で先に通報済み) は
    // どちらの分岐にも該当せず、ここでは何もしない。コンポーネント末尾の早期 return
    // (dipsFlightPlanId 有りなら「DIPS通報済み」表示) が同一レンダー内で常に優先され、
    // banner を設定してもユーザーには見えない到達不能コードになるため、あえて設定しない

    // リロード時の再処理と URL の汚れを防ぐため、他のクエリパラメータは保持したまま
    // dips のみを取り除く
    const remainingParams = new URLSearchParams(searchParams.toString());
    remainingParams.delete("dips");
    const newUrl = remainingParams.toString() ? `${pathname}?${remainingParams.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, planId, pathname, router, resubmitAfterDipsLink, dipsFlightPlanId]);

  const bannerElement = banner && (
    <p
      // 支援技術ユーザーにも連携結果が伝わるよう live region として通知する
      role={banner.type === "success" ? "status" : "alert"}
      className={`mb-3 text-sm ${banner.type === "success" ? "text-success" : "text-danger"}`}
    >
      {banner.message}
    </p>
  );

  if (dipsFlightPlanId) {
    // 通報成功直後の router.refresh() で dipsFlightPlanId が非 null になり、この早期
    // return に切り替わっても、直前に表示した重複件数 (安全上の情報) が消えないよう
    // banner をここでも描画する (2026-09-11 /code-review 指摘1)
    return (
      <div>
        {bannerElement}
        <p className="text-sm text-success">DIPS通報済み (飛行計画ID: {dipsFlightPlanId})</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null);

    const validated = validateAndBuildInput(form);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    setIsSubmitting(true);
    await sendDipsNotification(
      planId,
      validated.input,
      (result) => {
        setIsSubmitting(false);
        setIsOpen(false);
        const duplicateNotice = buildDuplicateRouteNotice(result.existOtherFlightRoutesCount);
        if (duplicateNotice) {
          setBanner({ type: "success", message: duplicateNotice });
        }
        router.refresh();
      },
      (err) => {
        if (err instanceof DipsAuthRequiredClientError) {
          // トークン未取得・失効: フォーム入力を退避し、連携後にこのページへ
          // 戻れるよう returnPath を添えて DIPS ログイン画面へ誘導する
          // (returnPath はクエリ文字列を含められない。サーバー側の
          // isSafeInternalReturnPath が ?dips=linked を安全に付与するため
          // ? を含む値を拒否する設計のため)
          savePendingNotifyForm(planId, form);
          window.location.href = dipsLoginUrl(err.realm, window.location.pathname);
          return;
        }
        setError(err instanceof Error ? err.message : "DIPS通報に失敗しました");
        setIsSubmitting(false);
      }
    );
  };

  return (
    <div>
      {!isOpen && bannerElement}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isPastNotifiableWindow}
        className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
      >
        DIPSへ通報
      </button>
      {isPastNotifiableWindow && (
        // サーバー側検証 (services/dipsService.ts) が必須の判定であり、これは事前に
        // 気づけるようにする UX 改善に過ぎない (H-5)
        <p className="mt-1 text-xs text-muted">
          飛行予定日時が古すぎるため、この飛行計画は通報できません
        </p>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dips-notify-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6"
          >
            <h2 id="dips-notify-dialog-title" className="mb-4 text-lg font-bold text-heading">
              DIPS飛行計画通報
            </h2>
            <p className="mb-4 text-xs text-muted">
              飛行計画の名称・日時・機体はこの計画から自動送信されます。以下は追加で必要な項目です。
            </p>

            {bannerElement}
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}

            <DipsNotifyForm form={form} onFormChange={setForm} />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="rounded border border-line px-3 py-1.5 text-sm text-body disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {isSubmitting ? "通報中..." : "通報する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
