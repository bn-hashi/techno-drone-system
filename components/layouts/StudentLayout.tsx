import React from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

// 受講生向けナビゲーションリンク定義
const NAVIGATION_LINKS = [
  { href: "/student/dashboard", label: "ダッシュボード" },
  { href: "/student/courses", label: "受講" },
  { href: "/student/exams", label: "試験" },
] as const;

interface StudentLayoutProps {
  children: React.ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              {NAVIGATION_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {label}
                </Link>
              ))}
            </div>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
