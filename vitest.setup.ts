import "@testing-library/jest-dom";
import { vi } from "vitest";

// next/font は Next.js のビルド時に解決されるため、テスト環境ではスタブする
vi.mock("next/font/google", () => ({
  Noto_Sans_JP: () => ({ className: "font-noto-sans-jp" }),
}));
