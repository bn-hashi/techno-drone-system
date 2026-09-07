"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchDipsFlightProhibitedAreas } from "@/lib/api/dips";
import type {
  DipsFlightProhibitedAreaInfo,
  FetchDipsFlightProhibitedAreasResult,
} from "@/lib/api/dips";
import { DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS } from "@/lib/constants/dipsFlightProhibitedAreaType";
import { DipsRouteErrorMessage } from "@/components/flight/DipsRouteErrorMessage";
import {
  DipsCircleSearchFields,
  validateCircleSearchInput,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_RADIUS_METERS,
  type CircleSearchFormState,
} from "@/components/flight/DipsCircleSearchFields";

/**
 * エリア種別の既定選択はガイドラインのリクエストボディサンプル (2.3.7、
 * レッドゾーン・イエローゾーン) に揃える。検索範囲の既定値は
 * `components/flight/DipsCircleSearchFields.tsx` を参照 (5-4 と共有)。
 */
const DEFAULT_AREA_TYPE_IDS = [5, 6];

interface FormState extends CircleSearchFormState {
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
    // I3 対応 (2026-09-06 レビュー): 冒頭で reset することで、前回の 502 エラーや
    // 前回の検索結果を必ず消してから新しい状態 (バリデーションエラー or 新しい検索) へ
    // 進める (DipsFlightPlanSearchPanel と同じ対応)
    mutation.reset();
    setValidationError(null);

    const validated = validateCircleSearchInput(form);
    if ("error" in validated) {
      setValidationError(validated.error);
      return;
    }
    if (form.areaTypeIds.length === 0) {
      setValidationError("飛行禁止エリア種別を1つ以上選択してください");
      return;
    }
    mutation.mutate({
      centerLongitude: validated.longitude,
      centerLatitude: validated.latitude,
      radiusMeters: validated.radiusMeters,
      flightProhibitedAreaTypeIds: form.areaTypeIds,
    });
  };

  return (
    <div>
      <div className="space-y-3 text-sm">
        <DipsCircleSearchFields
          form={form}
          onChange={(circle) => setForm({ ...form, ...circle })}
        />

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

      {mutation.isError && (
        <DipsRouteErrorMessage
          error={mutation.error}
          fallbackMessage="DIPS飛行禁止エリア情報の取得に失敗しました"
        />
      )}
      {mutation.isSuccess && !mutation.isPending && <SearchResults data={mutation.data} />}
    </div>
  );
}
