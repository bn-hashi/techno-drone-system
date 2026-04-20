import React from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type ButtonVariant = "primary" | "secondary" | "danger";

// バリアントごとの Tailwind クラスを as const で管理
const VARIANT_STYLES = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const satisfies Record<ButtonVariant, string>;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  // type を明示的に受け取り、未指定時は "button" にする（フォーム内での暗黙的な submit を防ぐ）
  type = "button",
  // className を明示的に受け取り、基底クラスに結合する（...rest による上書きを防ぐ）
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${className}`.trimEnd()}
      {...rest}
    >
      {isLoading && <LoadingSpinner />}
      {children}
    </button>
  );
}
