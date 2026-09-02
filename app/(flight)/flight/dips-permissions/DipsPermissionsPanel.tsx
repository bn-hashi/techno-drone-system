"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchDipsPermissions,
  dipsLoginUrl,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsPermissionInfo, FetchDipsPermissionsResult } from "@/lib/api/dips";

/** DIPS 許可・承認情報の React Query キャッシュキー */
const DIPS_PERMISSIONS_QUERY_KEY = ["dips-permissions"] as const;

/** true の制限事項フラグのみラベル化して表示する (false は「該当なし」なので表示しない) */
const PERMISSION_FLAGS: ReadonlyArray<{ key: keyof DipsPermissionInfo; label: string }> = [
  { key: "aboveDenselyInhabitedDistricts", label: "人口集中地区(DID)上空" },
  { key: "moreThan150mAboveTheGround", label: "地表から150m以上" },
  { key: "aroundAirports", label: "空港等周辺" },
  { key: "lessThan30m", label: "人・物件から30m未満" },
  { key: "overEventSites", label: "催し場所上空" },
  { key: "nightOperation", label: "夜間飛行" },
  { key: "beyondVisualLineOfSight", label: "目視外飛行" },
  { key: "transportHazardousMaterials", label: "危険物輸送" },
  { key: "dropObjects", label: "物件投下" },
];

/** この許可で該当する (true の) 飛行条件ラベルだけを返す */
function activeFlagLabels(permission: DipsPermissionInfo): string[] {
  return PERMISSION_FLAGS.filter((flag) => permission[flag.key] === true).map(
    (flag) => flag.label
  );
}

/**
 * DIPS の日付文字列 (YYYY-MM-DD または ISO 形式) を日本語表示用に整形する。
 * `DipsVerifyButton.tsx` の `formatValidPeriodEnd()` と同じ考え方 (パース不能な値は
 * そのまま返す)。DIPS が ISO 形式 (`2026-04-01T00:00:00+09:00`) を返すと生文字列のまま
 * 表示されていた (D4 差し戻し)。
 */
function formatPermissionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

interface PermissionCardProps {
  permission: DipsPermissionInfo;
}

function PermissionCard({ permission }: PermissionCardProps) {
  const flags = activeFlagLabels(permission);
  return (
    <li className="border border-gray-200 rounded p-4">
      <p className="font-medium text-gray-900">
        {permission.permissionNumber}
        {permission.permissionNumber2 && ` / ${permission.permissionNumber2}`}
      </p>
      <p className="mt-1 text-sm text-gray-600">受付番号: {permission.receptionNumber}</p>
      <p className="text-sm text-gray-600">
        許可期間: {formatPermissionDate(permission.permissionPeriodStart)} 〜{" "}
        {formatPermissionDate(permission.permissionPeriodEnd)}
      </p>
      <p className="text-sm text-gray-600">飛行場所: {permission.flightLocation}</p>
      {permission.uaInfos.length > 0 && (
        <p className="text-sm text-gray-600">
          機体: {permission.uaInfos.map((ua) => `${ua.uaName} (${ua.regSymbol})`).join(", ")}
        </p>
      )}
      {flags.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">該当する飛行条件: {flags.join(" / ")}</p>
      )}
    </li>
  );
}

interface PermissionResultsProps {
  data: FetchDipsPermissionsResult;
}

/**
 * 取得成功時の結果表示 (除外件数の注記・0件メッセージ・一覧)。
 * `role="status"` で非同期結果の更新をスクリーンリーダーへ通知する
 * (`components/auth/LoginForm.tsx` のエラー表示と同じ考え方。D4 差し戻し)。
 */
function PermissionResults({ data }: PermissionResultsProps) {
  return (
    <div role="status" aria-live="polite">
      {data.excludedCount > 0 && (
        // 個人情報や除外理由の値そのものは含めず、件数のみ表示する。除外があった以上
        // 一覧が不完全である可能性を明示する (F7 差し戻し: DipsAircraftPickerModal.tsx の
        // 文言水準に揃え、「解消しなければ問い合わせる」導線まで示す)
        <p className="mt-4 text-sm text-amber-700">
          {data.excludedCount}
          件の許可・承認情報を読み込めませんでした。表示されている許可・承認情報以外にも
          情報がある可能性があります。解消しない場合はサポートへお問い合わせください
        </p>
      )}

      {data.permissions.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">許可・承認情報がありません</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.permissions.map((permission, index) => (
            // receptionNumber の一意性・非空はスキーマ上保証されないため index と
            // 組み合わせて一意にする (重複時に1件消えるのを防ぐ。D2 差し戻し)
            <PermissionCard key={`${permission.receptionNumber}-${index}`} permission={permission} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PermissionFetchErrorProps {
  error: unknown;
}

/** 取得失敗時の表示 (DIPS ログイン誘導 / アプリセッション切れ / 汎用エラー) */
function PermissionFetchError({ error }: PermissionFetchErrorProps) {
  if (error instanceof DipsAuthRequiredClientError) {
    return (
      <p className="mt-4 text-sm text-gray-700" role="status" aria-live="polite">
        DIPSへのログインが必要です。
        <a
          href={dipsLoginUrl(
            error.realm,
            typeof window !== "undefined" ? window.location.pathname : undefined
          )}
          className="ml-1 text-blue-600 hover:underline"
        >
          DIPSにログインする
        </a>
      </p>
    );
  }

  if (error instanceof AppSessionExpiredClientError) {
    return (
      <p className="mt-4 text-sm text-gray-700" role="status" aria-live="polite">
        ログインが必要です。再度ログインしてください。
        <a href="/login" className="ml-1 text-blue-600 hover:underline">
          ログイン画面へ
        </a>
      </p>
    );
  }

  // role="alert" は本来 assertive (即時) な通知を意味する。aria-live="polite" を
  // 併記すると polite に上書きされ、重大なエラーと通常結果の優先度が区別できなくなる
  // ため付けない (F9 差し戻し。DipsNotifyButton.tsx の bannerElement と同じ判断)
  return (
    <p className="mt-4 text-sm text-red-600" role="alert">
      {error instanceof Error ? error.message : "DIPS許可・承認情報の取得に失敗しました"}
    </p>
  );
}

/** DIPS 認可コールバック (`?dips=...`) の処理結果。ボタンを押していない状態と
 * 見分けがつくよう、成功・失敗を明示的なバナーとして表示する (F6 差し戻し) */
interface OAuthReturnBanner {
  type: "success" | "error";
  message: string;
}

/**
 * 「許可・承認情報を取得」ボタンの疎通確認パネル。
 *
 * 外部 API (IP 制限・他事業者共用の検証環境) への呼び出しはボタンクリック以外で
 * 発生させない (「ボタンを1回押す = DIPS を1回呼ぶ」がこの画面の約束。2026-08-26
 * 差し戻し A1/A2)。そのため `enabled: false` で自動フェッチ・自動バックグラウンド
 * 再取得 (invalidateQueries・マウント時・stale 時の自動再取得含む) を一律止め、
 * クリック時は毎回 `refetch()` で明示的に取得する。`refetch()` は `enabled: false` でも
 * 動作し、staleTime の影響を受けず必ずネットワーク越しに取得する (TanStack Query の
 * 仕様。QueryProvider.tsx の staleTime 60秒とキャッシュが噛み合い、再マウント後の
 * 1回目のクリックで fetch されない不具合があった)。`refetchOnWindowFocus` /
 * `refetchOnReconnect` も明示的に false にする (IP 制限された検証環境を、フォーカス
 * 復帰や再接続だけで無操作に叩いてしまうのを防ぐ)。
 *
 * `networkMode: "always"` (2026-08-28 差し戻し F3): 既定の `networkMode: "online"` だと、
 * オフライン判定中の `refetch()` はクエリが `paused` になり、queryFn 自体が呼ばれないまま
 * `isFetching` も false に戻る (＝クリックしても何も起きない「無反応ボタン」に見える)。
 * さらに悪いことに、その paused フェッチは接続復帰時に自動で再開され、
 * 「クリックしていないのに DIPS を叩く」という A2 で防いだはずの経路が別の形で復活する。
 * 検討したもう一案 (`fetchStatus === "paused"` を表示する) は、クリック直後に一瞬だけ
 * 出るローディング表示に加えて「オフラインのため保留中」という第三の表示を作り込む必要が
 * あり、かつ paused フェッチの自動再開という A2 の問題そのものは解決しない。
 * `networkMode: "always"` はオンライン状態に関わらず常に queryFn を呼ぶため、オフライン時は
 * 素の `fetch()` が失敗し通常のエラー表示 (`fetchDipsPermissions` が日本語化した
 * ネットワークエラーメッセージ) にそのまま乗る。paused という中間状態自体が存在しなくなる
 * ため、無反応にもならず、再接続時に何かが自動再開することもない。
 */
export function DipsPermissionsPanel() {
  const [hasRequested, setHasRequested] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<OAuthReturnBanner | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const query = useQuery({
    queryKey: DIPS_PERMISSIONS_QUERY_KEY,
    queryFn: fetchDipsPermissions,
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: "always",
  });

  const handleClick = () => {
    setHasRequested(true);
    void query.refetch();
  };

  // DIPS 認可フローから戻ってきたとき (?dips=...) の処理 (F6 差し戻し)。
  // `DipsNotifyButton.tsx` の同機構を踏襲する。認可失敗 (error/state_error) を
  // 「未連携 (まだボタンを押していない)」状態と混同すると、runbook の切り分け表にある
  // 「無限ログインループ」と見分けがつかなくなるため、明示的なバナーで区別する。
  // 成功時 (linked) もこの画面では自動では取得しない (「ボタンを押す = DIPS を呼ぶ」の
  // 契約を OAuth 復帰時にも一貫させるため)。ユーザーには改めてボタンを押してもらう。
  useEffect(() => {
    const dipsResult = searchParams.get("dips");
    if (!dipsResult) return;

    if (dipsResult === "linked") {
      setOauthBanner({
        type: "success",
        message: "DIPS連携が完了しました。「許可・承認情報を取得」ボタンを押して取得してください。",
      });
    } else {
      setOauthBanner({
        type: "error",
        message:
          dipsResult === "state_error"
            ? "DIPS連携の検証に失敗しました。もう一度お試しください。"
            : "DIPS連携に失敗しました。もう一度お試しください。",
      });
    }

    // リロード時の再処理と URL の汚れを防ぐため、他のクエリパラメータは保持したまま
    // dips のみを取り除く
    const remainingParams = new URLSearchParams(searchParams.toString());
    remainingParams.delete("dips");
    const newUrl = remainingParams.toString() ? `${pathname}?${remainingParams.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <div>
      {oauthBanner && (
        <p
          role={oauthBanner.type === "success" ? "status" : "alert"}
          aria-live={oauthBanner.type === "success" ? "polite" : undefined}
          className={`mb-3 text-sm ${oauthBanner.type === "success" ? "text-gray-700" : "text-red-600"}`}
        >
          {oauthBanner.message}
        </p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={query.isFetching}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {query.isFetching ? "取得中..." : "許可・承認情報を取得"}
      </button>
      <p className="mt-1 text-xs text-gray-500">
        DIPSにログインしたアカウントの許可・承認情報を取得します
      </p>

      {hasRequested && query.isError && <PermissionFetchError error={query.error} />}
      {/* 失敗直後は古いデータを表示しない (isError のときはデータブロックを出さない。
          401 直後に「ログインが必要です」と古い許可カードが同時に出ていた D4 差し戻し)。
          isFetching 中も表示しない (F2 差し戻し: 再マウント後にクリックすると、
          refetch() が返るまでの間、別マウント時の古いキャッシュがそのまま描画されていた) */}
      {hasRequested && !query.isError && !query.isFetching && query.data && (
        <PermissionResults data={query.data} />
      )}
    </div>
  );
}
