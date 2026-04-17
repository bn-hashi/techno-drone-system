/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma と pg はサーバーサイドのネイティブパッケージのためバンドルを避ける
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  },
};

export default nextConfig;
