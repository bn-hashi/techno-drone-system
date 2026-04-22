import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface NavLink {
  href: string;
  label: string;
}

interface AppLayoutProps {
  /** スクリーンリーダー向けナビゲーション領域のラベル */
  navLabel: string;
  links: readonly NavLink[];
  children: ReactNode;
}

// Server Component: LogoutButton (Client Component) を子として含むが、
// Next.js App Router ではサーバーコンポーネントがクライアントコンポーネントを
// インポートすることは正式にサポートされたパターン。
export function AppLayout({ navLabel, links, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav aria-label={navLabel} className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              {links.map(({ href, label }) => (
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
