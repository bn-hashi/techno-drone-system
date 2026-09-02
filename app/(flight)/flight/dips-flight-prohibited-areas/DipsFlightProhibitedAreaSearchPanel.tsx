"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  searchDipsFlightProhibitedAreas,
  DipsAuthRequiredClientError,
  AppSessionExpiredClientError,
} from "@/lib/api/dips";
import type {
  DipsFlightProhibitedAreaInfo,
  FetchDipsFlightProhibitedAreasResult,
} from "@/lib/api/dips";
import { DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS } from "@/lib/constants/dipsFlightProhibitedAreaType";
import { DipsAuthPrompt } from "@/components/flight/DipsAuthPrompt";
import { AppSessionExpiredPrompt } from "@/components/flight/AppSessionExpiredPrompt";

/**
 * 検索フォームの既定値 (東京駅周辺、半径1000m)。設定通知書「検証環境での確認ポイント」に
 * 検索条件の指定はないため、ガイドラインのリクエストボディサンプル (2.3.7) と同じ
 * 桁数感の値を使う。エリア種別の既定選択も同サンプル (レッドゾーン・イエローゾーン) に揃える。
 */
const DEFAULT_LONGITUDE = "139.7671";
const DEFAULT_LATITUDE = "35.6812";
const DEFAULT_RADIUS_METERS = "1000";
const DEFAULT_AREA_TYPE_IDS = [5, 6];

interface FormState {
  longitude: string;
  latitude: string;
  radiusMeters: string;
  areaTypeIds: number[];
}

const INITIAL_FORM: FormState = {
  longitude: DEFAULT_LONGITUDE,
  latitude: DEFAULT_LATITUDE,
  radiusMeters: DEFAULT_RADIUS_METERS,
  areaTypeIds: DEFAULT_AREA_TYPE_IDS,
};

function AreaCard({ area }: { area: DipsFlightProhibitedAreaInfo }) {
  return (
    <li className="border border-gray-200 rounded p-4">
      <p className="font-medium text-gray-900">{area.name}</p>
      <p className="mt-1 text-sm text-gray-600">{area.detail}</p>
      <p className="text-sm text-gray-600">
        有効期限: {area.startTime} 〜 {area.finishTime}
      </p>
      <p className="text-xs text-gray-500">種別コード: {area.areaTypeId}</p>
    </li>
  );
}

function SearchResults({ data }: { data: FetchDipsFlightProhibitedAreasResult }) {
  return (
    <div role="status" aria-live="polite">
      {data.excludedCount > 0 && (
        <p className="mt-4 text-sm text-amber-700">
          {data.excludedCount}
          件の飛行禁止エリア情報を読み込めませんでした。表示されている情報以外にもエリアが
          ある可能性があります
        </p>
      )}
      {data.areas.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">該当する飛行禁止エリアがありません</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.areas.map((area, index) => (
            <AreaCard key={`${area.areaId}-${index}`} area={area} />
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
      {error instanceof Error ? error.message : "DIPS飛行禁止エリア情報の取得に失敗しました"}
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
 * 飛行禁止エリア情報取得 API (5-5) の疎通確認パネル。
 *
 * 検証環境は他事業者共用・IP制限下にあるため、DipsPermissionsPanel と同じく「ボタンを
 * 押す = DIPS を1回呼ぶ」の契約を守る (自動検索・自動再検索は行わない)。
 */
export function DipsFlightProhibitedAreaSearchPanel() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    // アロー関数でラップし、TanStack Query が mutationFn に付与する第2引数
    // (client/meta 等のコンテキスト) が fetch 関数へそのまま渡らないようにする
    mutationFn: (input: Parameters<typeof searchDipsFlightProhibitedAreas>[0]) =>
      searchDipsFlightProhibitedAreas(input),
  });

  const toggleAreaType = (code: number) => {
    setForm((prev) => ({
      ...prev,
      areaTypeIds: prev.areaTypeIds.includes(code)
        ? prev.areaTypeIds.filter((c) => c !== code)
        : [...prev.areaTypeIds, code],
    }));
  };

  const handleSubmit = () => {
    setValidationError(null);
    const longitude = parseNumber(form.longitude);
    const latitude = parseNumber(form.latitude);
    const radiusMeters = parseNumber(form.radiusMeters);
    if (longitude === null || latitude === null || radiusMeters === null || radiusMeters <= 0) {
      setValidationError("経度・緯度・半径 (1以上) を正しく入力してください");
      return;
    }
    if (form.areaTypeIds.length === 0) {
      setValidationError("飛行禁止エリア種別を1つ以上選択してください");
      return;
    }
    mutation.mutate({
      centerLongitude: longitude,
      centerLatitude: latitude,
      radiusMeters,
      flightProhibitedAreaTypeIds: form.areaTypeIds,
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

        <fieldset>
          <legend className="mb-1 font-medium text-gray-900">飛行禁止エリア種別 (複数選択可)</legend>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS.map((option) => (
              <label key={option.code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.areaTypeIds.includes(option.code)}
                  onChange={() => toggleAreaType(option.code)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
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
        {mutation.isPending ? "検索中..." : "飛行禁止エリアを検索"}
      </button>

      {mutation.isError && <SearchError error={mutation.error} />}
      {mutation.isSuccess && !mutation.isPending && <SearchResults data={mutation.data} />}
    </div>
  );
}
