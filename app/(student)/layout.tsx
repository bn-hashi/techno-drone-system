import { StudentLayout } from "@/components/layouts/StudentLayout";
import React from "react";

interface StudentRootLayoutProps {
  children: React.ReactNode;
}

export default function StudentRootLayout({ children }: StudentRootLayoutProps) {
  return <StudentLayout>{children}</StudentLayout>;
}
