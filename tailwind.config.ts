import type { Config } from "tailwindcss";

// デザイントークンは Claude Design「登録講習機関 管理システム」由来。
// accent はデザイン上で可変だが、既定値の #2563eb を採用する。
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#1d4ed8",
        accent: "#2563eb",
        surface: "#f4f6fa",
        heading: "#1a2233",
        body: "#364152",
        muted: "#667085",
        faint: "#98a2b3",
        line: {
          DEFAULT: "#e7ebf2",
          soft: "#f0f2f6",
        },
        sidebar: {
          DEFAULT: "#141b2d",
          group: "#5b647a",
          item: "#aab2c5",
          dot: "#3a435c",
        },
        success: "#15803d",
        warning: "#b45309",
        danger: "#dc2626",
        neutral: "#64748b",
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.05)",
        "card-hover": "0 6px 18px rgba(16,24,40,.10)",
      },
    },
  },
  plugins: [],
};
export default config;
