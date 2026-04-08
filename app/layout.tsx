import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ドローンスクール 学科オンライン講座",
  description: "二等無人航空機操縦士 学科試験対策オンラインシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
