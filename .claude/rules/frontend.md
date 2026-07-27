---
description: フロントエンド (Next.js) コーディング規約
globs:
  - "frontend/**/*.{ts,tsx}"
  - "web/**/*.{ts,tsx}"
alwaysApply: false
---

# フロントエンド規約

## アーキテクチャ
- Next.js App Router を使用
- Server Component をデフォルトとし、クライアント側状態が必要な場合のみ `"use client"`
- ディレクトリ構成: `app/` (ルーティング) / `components/` / `hooks/` / `lib/` / `types/`

## コードスタイル
- TypeScript strict モード必須
- `any` 禁止。やむを得ない場合は `unknown` + 型ガード
- フォーマッタ: Prettier / リンタ: ESLint (next/core-web-vitals)
- コンポーネントは関数コンポーネント + 名前付き export

## スタイリング
- Tailwind CSS のみ使用。インラインスタイル・CSS Modules は禁止
- デザイントークンは `tailwind.config.ts` に集約

## データ取得
- Server Component では fetch + Next.js キャッシュを利用
- Client Component からは TanStack Query を使用
- API 呼び出しは `lib/api/` に集約。コンポーネント内で直接 fetch しない

## 禁止事項
- `useEffect` での無限ループ (依存配列を必ず確認)
- OAuth 往復の `returnPath` にクエリ文字列・フラグメントを付けること。サーバー側の
  `isSafeInternalReturnPath` (`lib/dips/returnPath.ts`) が `?` `#` を含む値を拒否し、
  不正な値はエラーにならず黙って無視され、戻り先 cookie も削除される。クエリを往復
  させたい場合は sessionStorage 等の別チャネルを使う
- `dangerouslySetInnerHTML` (やむを得ない場合は DOMPurify 経由)