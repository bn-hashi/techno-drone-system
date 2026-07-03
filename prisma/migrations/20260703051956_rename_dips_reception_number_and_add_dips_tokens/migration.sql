-- 通報レスポンスの実体が「受付番号」ではなく採番された飛行計画IDであることが判明したためリネーム
ALTER TABLE "flight_plans" RENAME COLUMN "dipsReceptionNumber" TO "dipsFlightPlanId";

-- DIPS OIDC トークン保管 (ユーザー×realm 単位、暗号化済み値を格納)
CREATE TABLE "dips_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realm" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dips_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dips_tokens_userId_realm_key" ON "dips_tokens"("userId", "realm");

ALTER TABLE "dips_tokens" ADD CONSTRAINT "dips_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
