import { Suspense } from "react";
import { SetupPasswordForm } from "./SetupPasswordForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// トークンベースのページなので静的生成の対象外とする
export const dynamic = "force-dynamic";

export default function SetupPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<LoadingSpinner />}>
        <SetupPasswordForm />
      </Suspense>
    </div>
  );
}
