import { Suspense } from "react";
import { SetupAgreementForm } from "./SetupAgreementForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// トークンベースのページなので静的生成の対象外とする
export const dynamic = "force-dynamic";

export default function SetupAgreementPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <Suspense fallback={<LoadingSpinner />}>
        <SetupAgreementForm />
      </Suspense>
    </div>
  );
}
