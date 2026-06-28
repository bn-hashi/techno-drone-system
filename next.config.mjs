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
  async redirects() {
    return [
      { source: "/videos", destination: "/admin/videos", permanent: false },
      { source: "/questions", destination: "/admin/questions", permanent: false },
      { source: "/exam-results", destination: "/admin/exam-results", permanent: false },
      {
        source: "/students/:id",
        destination: "/admin/students/:id",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
