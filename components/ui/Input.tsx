"use client";

import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  id,
  className = "",
  // aria-describedby を明示的に受け取り、error 時の errorId と結合する（...rest による上書きを防ぐ）
  "aria-describedby": ariaDescribedBy,
  ...rest
}: InputProps) {
  const generatedId = useId();
  // 呼び出し元が id を指定した場合はそれを優先する
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const borderClass = error ? "border-red-500" : "border-gray-300";
  const combinedDescribedBy =
    [error ? errorId : undefined, ariaDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-describedby={combinedDescribedBy}
        aria-invalid={error ? true : undefined}
        className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${borderClass} ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
