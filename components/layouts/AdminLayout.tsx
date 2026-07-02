import type { ReactNode } from "react";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import type { NavGroup } from "@/components/layouts/SidebarNav";

// デザイン「登録講習機関 管理システム」のナビグループ構成に合わせて
// 既存ルートのみをグループ化する (未実装機能はナビに載せない)
const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "受講管理",
    items: [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/users", label: "受講者管理" },
      { href: "/admin/applications", label: "入学申請" },
    ],
  },
  {
    title: "eラーニング (LMS)",
    items: [
      { href: "/admin/courses", label: "コース管理" },
      { href: "/admin/videos", label: "動画管理" },
      { href: "/admin/questions", label: "問題バンク" },
      { href: "/admin/exam-results", label: "試験結果" },
      { href: "/admin/qa", label: "質疑応答" },
      { href: "/admin/fraud-flags", label: "不正フラグ" },
    ],
  },
  {
    title: "修了・出力",
    items: [{ href: "/admin/judgments", label: "成績・修了判定" }],
  },
  {
    title: "飛行管理",
    items: [{ href: "/admin/flight-logs", label: "飛行日誌" }],
  },
] as const;

// /admin はダッシュボード。他リンクの親パスのため完全一致のみアクティブにする
const ROOT_HREFS = ["/admin"] as const;

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarLayout
      navLabel="管理者メニュー"
      groups={NAV_GROUPS}
      rootHrefs={ROOT_HREFS}
      userLabel="機関管理者"
      fallbackTitle="管理コンソール"
    >
      {children}
    </SidebarLayout>
  );
}
