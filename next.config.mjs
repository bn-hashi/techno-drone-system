/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // サーバー専用パッケージは webpack でバンドルせず実行時 Node require に委ねる。
    // - Prisma / pg: ネイティブパッケージ
    // - @react-pdf/renderer: Node 専用 (修了証明書 PDF 生成)。fontkit 等を含む
    serverComponentsExternalPackages: [
      "@prisma/client",
      "@prisma/adapter-pg",
      "pg",
      "@react-pdf/renderer",
    ],
  },
};

export default nextConfig;
