"use client";

import React, { useEffect, useId, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** モーダルのタイトル。未指定の場合は ariaLabel を必ず指定してください。 */
  title?: string;
  /** title 未指定時に role="dialog" のアクセシブル名を提供します。 */
  ariaLabel?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, ariaLabel, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // モーダルを閉じた後にフォーカスを元の要素へ戻すために保持する
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // モーダルが開いたときにフォーカスを移動し、Escキーで閉じる。
  // クローズ時は previousFocusRef が示す要素へフォーカスを復帰させる。
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      // フォーカストラップ: Tab / Shift+Tab でフォーカスがモーダル外へ抜けるのを防ぐ
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className="relative z-10 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          )}
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
