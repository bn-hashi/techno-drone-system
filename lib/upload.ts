import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { BusinessError } from "@/services/errors";

// ファイルアップロード先のベースディレクトリ
export const UPLOAD_BASE_DIR = "/home/ubuntu/uploads/";

// アップロード可能な最大ファイルサイズ (10MB)
// 航空法の本人確認資料は高解像度スキャンが必要なため 10MB に設定
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// 許可する MIME タイプとその拡張子のマッピング
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

/**
 * アップロードされたファイルをローカルディスクに保存する
 *
 * @param file - アップロードされた File オブジェクト
 * @param subdirectory - 保存先サブディレクトリ (例: "id-documents", "photos")
 * @returns 保存先のフルパス
 */
export async function saveUploadedFile(file: File, subdirectory: string): Promise<string> {
  if (file.size === 0) {
    throw new BusinessError("ファイルが空です");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BusinessError("ファイルサイズが上限を超えています");
  }

  const extension = ALLOWED_MIME_TYPES[file.type];
  if (!extension) {
    throw new BusinessError("許可されていないファイル形式です");
  }

  // パストラバーサル攻撃を防ぐため、解決後のパスがベースディレクトリ内に収まることを確認する
  const resolvedBase = resolve(UPLOAD_BASE_DIR);
  const resolvedDir = resolve(UPLOAD_BASE_DIR, subdirectory);
  if (!resolvedDir.startsWith(resolvedBase + "/")) {
    throw new BusinessError("不正なサブディレクトリです");
  }

  const dirPath = resolvedDir;
  await mkdir(dirPath, { recursive: true });

  const fileName = `${randomUUID()}${extension}`;
  const filePath = `${dirPath}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  return filePath;
}
