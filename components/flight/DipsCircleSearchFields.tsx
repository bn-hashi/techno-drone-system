"use client";

/**
 * 検索範囲 (円: 中心点の経度・緯度・半径) の入力欄・既定値・パース・検証。
 *
 * `DipsFlightPlanSearchPanel.tsx` と `DipsFlightProhibitedAreaSearchPanel.tsx` が、
 * `parseNumber`・既定値定数・fieldset マークアップ・座標検証を同一のまま複製していたため
 * (2026-09-06 レビュー I7。約120行相当)、ここへ1本化する。
 */

import { isWithinJapanBounds, OUT_OF_JAPAN_WARNING_MESSAGE } from "@/lib/utils/japanBounds";

/** 検索フォームの既定値 (東京駅周辺、半径1000m)。汎用的な既定値であり、このシステムの
 * 検証環境利用開始予定地に依らない */
export const DEFAULT_LONGITUDE = "139.7671";
export const DEFAULT_LATITUDE = "35.6812";
export const DEFAULT_RADIUS_METERS = "1000";

export interface CircleSearchFormState {
  longitude: string;
  latitude: string;
  radiusMeters: string;
}

const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
/** 半径の下限 (m)。DIPS へ送信する検索範囲として意味を持つ最小値 */
const MIN_RADIUS_METERS = 1;

/** 数値入力欄をパースする。空欄・非数値なら null */
export function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export interface CircleSearchValidationSuccess {
  longitude: number;
  latitude: number;
  radiusMeters: number;
}

export interface CircleSearchValidationFailure {
  error: string;
}

export type CircleSearchValidationResult =
  | CircleSearchValidationSuccess
  | CircleSearchValidationFailure;

/**
 * 検索範囲 (経度・緯度・半径) の入力値を検証する。
 *
 * I10 対応 (2026-09-06 レビュー): 以前は文言が「半径 (1以上)」なのに判定が
 * `radiusMeters <= 0` で、`0.5` のような1未満の小数がそのまま通っていた。ここでは
 * `radiusMeters < MIN_RADIUS_METERS` で文言と判定を一致させる。経度・緯度の範囲チェックも
 * クライアント側に無く、`999` 等を送るとサーバーの汎用400になり利用者にどの欄が悪いか
 * 伝わらなかったため、ここで追加する。
 */
export function validateCircleSearchInput(form: CircleSearchFormState): CircleSearchValidationResult {
  const longitude = parseNumber(form.longitude);
  if (longitude === null || longitude < MIN_LONGITUDE || longitude > MAX_LONGITUDE) {
    return { error: `経度は${MIN_LONGITUDE}〜${MAX_LONGITUDE}の範囲の数値で入力してください` };
  }

  const latitude = parseNumber(form.latitude);
  if (latitude === null || latitude < MIN_LATITUDE || latitude > MAX_LATITUDE) {
    return { error: `緯度は${MIN_LATITUDE}〜${MAX_LATITUDE}の範囲の数値で入力してください` };
  }

  const radiusMeters = parseNumber(form.radiusMeters);
  if (radiusMeters === null || radiusMeters < MIN_RADIUS_METERS) {
    return { error: `半径は${MIN_RADIUS_METERS}以上の数値で入力してください` };
  }

  return { longitude, latitude, radiusMeters };
}

interface DipsCircleSearchFieldsProps {
  form: CircleSearchFormState;
  onChange: (form: CircleSearchFormState) => void;
}

/** 経度・緯度が入力済みで、かつ日本国外を指しているか (req-012 段階1) */
function isOutOfJapanWarningVisible(form: CircleSearchFormState): boolean {
  const longitude = parseNumber(form.longitude);
  const latitude = parseNumber(form.latitude);
  if (longitude === null || latitude === null) return false;
  return !isWithinJapanBounds(longitude, latitude);
}

/** 経度・緯度・半径の3つの数値入力欄 (fieldset)。両検索パネルで共有する */
export function DipsCircleSearchFields({ form, onChange }: DipsCircleSearchFieldsProps) {
  return (
    <fieldset className="rounded border border-gray-200 p-3">
      <legend className="px-1 text-xs text-gray-500">検索範囲 (円: 中心と半径)</legend>
      {isOutOfJapanWarningVisible(form) && (
        // role="alert" は打鍵のたびに読み上げを割り込ませるため使わない (role="status" + aria-live="polite")
        <p role="status" aria-live="polite" className="mb-2 text-xs text-warning">
          {OUT_OF_JAPAN_WARNING_MESSAGE}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-700">経度</span>
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e) => onChange({ ...form, longitude: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-700">緯度</span>
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e) => onChange({ ...form, latitude: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-700">半径 (m)</span>
          <input
            type="number"
            min={1}
            value={form.radiusMeters}
            onChange={(e) => onChange({ ...form, radiusMeters: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>
    </fieldset>
  );
}
