import { AdminLayout } from "@/components/layouts/AdminLayout";
import React from "react";

interface AdminRootLayoutProps {
  children: React.ReactNode;
}

export default function AdminRootLayout({ children }: AdminRootLayoutProps) {
  return <AdminLayout>{children}</AdminLayout>;
}
