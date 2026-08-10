"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  fetchDipsOwnedAircrafts,
  dipsLoginUrl,
  DipsAuthRequiredClientError,
} from "@/lib/api/dips";
import type { DipsOwnedAircraftDto } from "@/lib/api/dips";
import {
  DIPS_UA_STATUS_LABELS,
  DIPS_DEREGISTRATION_REASON_LABELS,
} from "@/lib/constants/dipsAircraftStatus";

interface DipsAircraftPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 選択可能な機体 (isSelectable=true) が選ばれたときに呼ばれる */
  onSelect: (aircraft: DipsOwnedAircraftDto) => void;
  /** DIPS 未連携時のログイン誘導で、連携完了後に戻ってくるページのパス */
  returnPath?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; aircrafts: DipsOwnedAircraftDto[] }
  | { status: "authRequired"; realm: string }
  | { status: "error"; message: string };

/** 機体ステータスに対応する Badge の見た目 (既存の active/pending/danger 語彙を流用) */
function statusBadgeVariant(status: DipsOwnedAircraftDto["status"]): "active" | "pending" | "danger" {
  if (status === 1) return "active";
  if (status === 2) return "pending";
  return "danger";
}

/** 機体の状態ラベル (抹消済みは抹消理由を併記する) */
function statusLabel(aircraft: DipsOwnedAircraftDto): string {
  const base = DIPS_UA_STATUS_LABELS[aircraft.status];
  if (aircraft.deregistrationReason) {
    return `${base} (${DIPS_DEREGISTRATION_REASON_LABELS[aircraft.deregistrationReason]})`;
  }
  return base;
}

/**
 * DIPS ログイン済みアカウントが所有する機体を一覧表示し、1機を選択できるモーダル。
 * 機体フォームの「DIPSから取り込む」ボタンから開く。所有者・使用者の情報は表示しない。
 */
export function DipsAircraftPickerModal({
  isOpen,
  onClose,
  onSelect,
  returnPath,
}: DipsAircraftPickerModalProps) {
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetchDipsOwnedAircrafts(includeInvalid)
      .then((aircrafts) => {
        if (!cancelled) setState({ status: "loaded", aircrafts });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DipsAuthRequiredClientError) {
          setState({ status: "authRequired", realm: err.realm });
          return;
        }
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "DIPS機体情報の取得に失敗しました",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, includeInvalid]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DIPSから機体を取り込む">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInvalid}
            onChange={(e) => setIncludeInvalid(e.target.checked)}
          />
          無効な機体も表示
        </label>

        {state.status === "loading" && <p className="text-sm text-gray-500">読み込み中...</p>}

        {state.status === "authRequired" && (
          <p className="text-sm text-gray-700">
            DIPSへのログインが必要です。
            <a
              href={dipsLoginUrl(state.realm, returnPath)}
              className="ml-1 text-blue-600 hover:underline"
            >
              DIPSにログインする
            </a>
          </p>
        )}

        {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}

        {state.status === "loaded" && state.aircrafts.length === 0 && (
          <p className="text-sm text-gray-500">DIPSに登録された機体がありません</p>
        )}

        {state.status === "loaded" && state.aircrafts.length > 0 && (
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
            {state.aircrafts.map((aircraft) => (
              <li key={aircraft.registrationCode} className="py-2">
                <button
                  type="button"
                  disabled={!aircraft.isSelectable}
                  onClick={() => onSelect(aircraft)}
                  className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="text-sm">
                    <span className="font-mono">{aircraft.registrationCode}</span>
                    <span className="ml-2 text-gray-500">
                      {aircraft.manufacturer} {aircraft.modelNumber}
                    </span>
                  </span>
                  <Badge variant={statusBadgeVariant(aircraft.status)}>
                    {statusLabel(aircraft)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
