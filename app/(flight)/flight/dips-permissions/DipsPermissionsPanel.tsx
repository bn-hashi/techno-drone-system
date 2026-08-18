"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDipsPermissions,
  dipsLoginUrl,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsPermissionInfo } from "@/lib/api/dips";

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
        許可期間: {permission.permissionPeriodStart} 〜 {permission.permissionPeriodEnd}
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

/**
 * 「許可・承認情報を取得」ボタンの疎通確認パネル。
 *
 * 外部 API (IP 制限・他事業者共用の検証環境) をページ読み込み時に自動発火させたくない
 * ため、`enabled` をボタンクリックで true に切り替える手動トリガー方式にしている
 * (DipsVerifyButton/DipsNotifyButton と同じ「ボタン起点」の UX を踏襲)。
 *
 * データ取得は TanStack Query (useQuery) に統一する (.claude/rules/frontend.md の規約:
 * Client Component からのデータ取得は TanStack Query を使う)。DipsAircraftPickerModal
 * 等の生 fetch は既知の規約違反で req-006 にバックログ化済みのため、新規実装では
 * ここを手本にすること (5-3/5-4/5-5 の UI もこの形を踏襲する)。
 */
export function DipsPermissionsPanel() {
  const [hasRequested, setHasRequested] = useState(false);

  const query = useQuery({
    queryKey: DIPS_PERMISSIONS_QUERY_KEY,
    queryFn: fetchDipsPermissions,
    enabled: hasRequested,
    retry: false,
  });

  const authRequiredRealm =
    query.error instanceof DipsAuthRequiredClientError ? query.error.realm : null;
  const isSessionExpired = query.error instanceof AppSessionExpiredClientError;
  const genericErrorMessage =
    query.error && !authRequiredRealm && !isSessionExpired
      ? (query.error instanceof Error ? query.error.message : "DIPS許可・承認情報の取得に失敗しました")
      : null;

  const handleClick = () => {
    if (hasRequested) {
      void query.refetch();
    } else {
      setHasRequested(true);
    }
  };

  return (
    <div>
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

      {authRequiredRealm && (
        <p className="mt-4 text-sm text-gray-700">
          DIPSへのログインが必要です。
          <a
            href={dipsLoginUrl(
              authRequiredRealm,
              typeof window !== "undefined" ? window.location.pathname : undefined
            )}
            className="ml-1 text-blue-600 hover:underline"
          >
            DIPSにログインする
          </a>
        </p>
      )}

      {isSessionExpired && (
        <p className="mt-4 text-sm text-gray-700">
          ログインが必要です。再度ログインしてください。
          <a href="/login" className="ml-1 text-blue-600 hover:underline">
            ログイン画面へ
          </a>
        </p>
      )}

      {genericErrorMessage && <p className="mt-4 text-sm text-red-600">{genericErrorMessage}</p>}

      {query.data && query.data.excludedCount > 0 && (
        // 個人情報や除外理由の値そのものは含めず、件数のみ表示する
        <p className="mt-4 text-sm text-amber-700">
          {query.data.excludedCount}件の許可・承認情報を読み込めませんでした
        </p>
      )}

      {query.data && query.data.permissions.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">許可・承認情報がありません</p>
      )}

      {query.data && query.data.permissions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {query.data.permissions.map((permission) => (
            <PermissionCard key={permission.receptionNumber} permission={permission} />
          ))}
        </ul>
      )}
    </div>
  );
}
