/**
 * node:fs/promises のラッパー
 *
 * ESM 環境で vi.mock によるモックを可能にするために、
 * テスト時に置き換えやすいアダプター層として分離する。
 */
import { unlink as nodeUnlink } from "node:fs/promises";
import { resolve } from "node:path";
import { UPLOAD_BASE_DIR } from "@/lib/upload";

/**
 * アップロードディレクトリ配下のファイルを削除する
 *
 * パストラバーサル攻撃を防ぐため、UPLOAD_BASE_DIR 外のパスは拒否する。
 *
 * @param filePath - 削除対象のファイルパス
 * @throws UPLOAD_BASE_DIR 外のパスが指定された場合
 */
export async function unlinkFile(filePath: string): Promise<void> {
  const resolvedBase = resolve(UPLOAD_BASE_DIR);
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(resolvedBase + "/")) {
    throw new Error("Attempted to delete file outside upload directory");
  }
  await nodeUnlink(resolvedPath);
}
