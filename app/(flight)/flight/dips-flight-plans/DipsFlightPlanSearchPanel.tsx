"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchDipsFlightPlans } from "@/lib/api/dips";
import type { DipsFlightPlanInfo, FetchDipsFlightPlansResult } from "@/lib/api/dips";
import { DipsRouteErrorMessage } from "@/components/flight/DipsRouteErrorMessage";
import {
  DipsCircleSearchFields,
  validateCircleSearchInput,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_RADIUS_METERS,
  type CircleSearchFormState,
} from "@/components/flight/DipsCircleSearchFields";

interface FormState extends CircleSearchFormState {
  onlyMine: boolean;
}

const INITIAL_FORM: FormState = {
  longitude: DEFAULT_LONGITUDE,
  latitude: DEFAULT_LATITUDE,
  radiusMeters: DEFAULT_RADIUS_METERS,
  onlyMine: false,
};

function FlightPlanCard({ plan }: { plan: DipsFlightPlanInfo }) {
  return (
    <li className="border border-gray-200 rounded p-4">
      <p className="font-medium text-gray-900">{plan.name ?? plan.flightPlanId}</p>
      <p className="mt-1 text-sm text-gray-600">
        飛行時間: {plan.startTime} 〜 {plan.finishTime}
      </p>
      <p className="text-sm text-gray-600">
        速度: {plan.flightSpeed}km/h ／ 高度: {plan.flightAltitude}m
      </p>
      {plan.departurePoint && plan.destinationPoint && (
        <p className="text-sm text-gray-600">
          {plan.departurePoint} → {plan.destinationPoint}
        </p>
      )}
      {plan.aircraftInfo === null && (
        <p className="mt-2 text-xs text-gray-400">
          機体・操縦者等の詳細は自アカウントの飛行計画のみ表示されます
        </p>
      )}
    </li>
  );
}

function SearchResults({ data }: { data: FetchDipsFlightPlansResult }) {
  return (
    <div role="status" aria-live="polite">
      {data.excludedCount > 0 && (
        <p className="mt-4 text-sm text-amber-700">
          {data.excludedCount}
          件の飛行計画情報を読み込めませんでした。表示されている情報以外にも飛行計画がある
          可能性があります
        </p>
      )}
      {data.flightPlans.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">該当する飛行計画がありません</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.flightPlans.map((plan, index) => (
            <FlightPlanCard key={`${plan.flightPlanId}-${index}`} plan={plan} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 飛行計画情報取得 API (5-4) の疎通確認パネル。
 *
 * ⚠️ 検証環境へのサンプルデータは未投入のため (設定通知書「検証環境での確認ポイント」
 * D36/E36)、疎通確認は「飛行計画通報受付API」(5-6) の成功が前提。「自分の飛行計画のみ」
 * オプションは、5-6 で通報したデータを検索対象に含める・除くを切り替えるためのもの。
 *
 * DipsFlightProhibitedAreaSearchPanel (5-5) と同じく「ボタンを押す = DIPS を1回呼ぶ」の
 * 契約を守る (自動検索・自動再検索は行わない)。
 */
export function DipsFlightPlanSearchPanel() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    // アロー関数でラップし、TanStack Query が mutationFn に付与する第2引数
    // (client/meta 等のコンテキスト) が fetch 関数へそのまま渡らないようにする
    mutationFn: (input: Parameters<typeof searchDipsFlightPlans>[0]) =>
      searchDipsFlightPlans(input),
  });

  const handleSubmit = () => {
    // I3 対応 (2026-09-06 レビュー): 冒頭で reset することで、前回の 502 エラーや
    // 前回の検索結果を必ず消してから新しい状態 (バリデーションエラー or 新しい検索) へ
    // 進める。以前はここが無く、バリデーション失敗時に古いエラーと新しいバリデーション
    // エラーが同時に表示され (role="alert" が2つになる)、成功後の不正入力では無効な
    // 条件のまま前回の結果一覧が残り続けていた
    mutation.reset();
    setValidationError(null);

    const validated = validateCircleSearchInput(form);
    if ("error" in validated) {
      setValidationError(validated.error);
      return;
    }
    mutation.mutate({
      centerLongitude: validated.longitude,
      centerLatitude: validated.latitude,
      radiusMeters: validated.radiusMeters,
      onlyMine: form.onlyMine,
    });
  };

  return (
    <div>
      <div className="space-y-3 text-sm">
        <DipsCircleSearchFields
          form={form}
          onChange={(circle) => setForm({ ...form, ...circle })}
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.onlyMine}
            onChange={(e) => setForm({ ...form, onlyMine: e.target.checked })}
          />
          <span>自分の飛行計画のみ検索する</span>
        </label>
      </div>

      {validationError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {validationError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={mutation.isPending}
        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {mutation.isPending ? "検索中..." : "飛行計画情報を検索"}
      </button>

      {mutation.isError && (
        <DipsRouteErrorMessage
          error={mutation.error}
          fallbackMessage="DIPS飛行計画情報の取得に失敗しました"
        />
      )}
      {mutation.isSuccess && !mutation.isPending && <SearchResults data={mutation.data} />}
    </div>
  );
}
