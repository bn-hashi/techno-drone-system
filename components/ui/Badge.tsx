import React from "react";

type BadgeVariant = "active" | "pending" | "danger";

// バリアントごとの Tailwind クラスを as const で管理し、型安全に参照する
const VARIANT_STYLES = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
} as const satisfies Record<BadgeVariant, string>;

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANT_STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
