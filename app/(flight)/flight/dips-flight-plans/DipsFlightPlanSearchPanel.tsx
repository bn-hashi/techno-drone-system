"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  searchDipsFlightPlans,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type { DipsFlightPlanInfo, FetchDipsFlightPlansResult } from "@/lib/api/dips";
import { DipsAuthPrompt } from "@/components/flight/DipsAuthPrompt";
import { AppSessionExpiredPrompt } from "@/components/flight/AppSessionExpiredPrompt";

/**
 * 検索フォームの既定値 (東京駅周辺、半径1000m)。5-5 (DipsFlightProhibitedAreaSearchPanel)
 * と同じ既定値を使う (このシステムの検証環境利用開始予定地に依らない汎用値)。
 */
const DEFAULT_LONGITUDE = "139.7671";
const DEFAULT_LATITUDE = "35.6812";
const DEFAULT_RADIUS_METERS = "1000";

interface FormState {
  longitude: string;
  latitude: string;
  radiusMeters: string;
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

function SearchError({ error }: { error: unknown }) {
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
      {error instanceof Error ? error.message : "DIPS飛行計画情報の取得に失敗しました"}
    </p>
  );
}

/** 数値入力欄をパースする。空欄・非数値なら null */
function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
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
    setValidationError(null);
    const longitude = parseNumber(form.longitude);
    const latitude = parseNumber(form.latitude);
    const radiusMeters = parseNumber(form.radiusMeters);
    if (longitude === null || latitude === null || radiusMeters === null || radiusMeters <= 0) {
      setValidationError("経度・緯度・半径 (1以上) を正しく入力してください");
      return;
    }
    mutation.mutate({
      centerLongitude: longitude,
      centerLatitude: latitude,
      radiusMeters,
      onlyMine: form.onlyMine,
    });
  };

  return (
    <div>
      <div className="space-y-3 text-sm">
        <fieldset className="rounded border border-gray-200 p-3">
          <legend className="px-1 text-xs text-gray-500">検索範囲 (円: 中心と半径)</legend>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-gray-700">経度</span>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-700">緯度</span>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-700">半径 (m)</span>
              <input
                type="number"
                min={1}
                value={form.radiusMeters}
                onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1"
              />
            </label>
          </div>
        </fieldset>

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

      {mutation.isError && <SearchError error={mutation.error} />}
      {mutation.isSuccess && !mutation.isPending && <SearchResults data={mutation.data} />}
    </div>
  );
}
