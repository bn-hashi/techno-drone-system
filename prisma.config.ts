import { defineConfig } from "prisma/config";

// Prisma CLI は Next.js と異なり .env を自動で読まないため、Node 標準機能で読み込む。
// 既にシェルで設定済みの環境変数が優先される (loadEnvFile は上書きしない)。
try {
  process.loadEnvFile();
} catch {
  // .env が存在しない環境 (CI 等) では、シェルの環境変数をそのまま使う
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Prisma 7 では seed コマンドは package.json の "prisma" 欄ではなくここに書く
  migrations: {
    seed: `npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts`,
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://ubuntu@localhost/drone_school",
  },
});
