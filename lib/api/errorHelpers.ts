// レスポンスからエラーメッセージを安全に取り出す。
// 非JSONボディや解析失敗時はフォールバック文言を返す。
export async function extractErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // 非JSON / 空ボディ。フォールバックを返す
  }
  return fallback;
}
