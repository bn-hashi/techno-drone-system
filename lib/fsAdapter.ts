/**
 * node:fs/promises のラッパー
 *
 * ESM 環境で vi.mock によるモックを可能にするために、
 * テスト時に置き換えやすいアダプター層として分離する。
 */
import { unlink as nodeUnlink } from "node:fs/promises";

export async function unlinkFile(filePath: string): Promise<void> {
  await nodeUnlink(filePath);
}
