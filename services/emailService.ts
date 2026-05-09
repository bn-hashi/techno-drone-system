// メール送信元アドレス (Resend の認証済みドメインを使用)
const FROM_ADDRESS = "noreply@drone-school.example.com";

export interface SendInviteEmailParams {
  to: string;
  setupUrl: string;
  studentName: string;
}

/** HTML 特殊文字をエスケープして XSS を防止する */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(studentName: string, setupUrl: string): string {
  const safeName = escapeHtml(studentName);
  const safeUrl = escapeHtml(setupUrl);
  return `
<p>${safeName} 様</p>
<p>この度はドローンスクールにお申し込みいただきありがとうございます。</p>
<p>以下のURLよりパスワードの設定と受講規約への同意を行い、本登録を完了してください。</p>
<p>
  <a href="${safeUrl}">${safeUrl}</a>
</p>
<p>このURLの有効期限は72時間です。期限を過ぎた場合は管理者にお問い合わせください。</p>
<p>ドローンスクール事務局</p>
  `.trim();
}

/**
 * 招待メールを送信する
 *
 * resend は静的プリレンダリング時に next/document の HtmlContext と競合するため
 * dynamic import を使用してモジュール評価を遅延させる。
 *
 * @param params - 送信先メールアドレス、セットアップURL、受講者名
 * @throws Resend からエラーが返された場合
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 RESEND_API_KEY が設定されていません");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { to, setupUrl, studentName } = params;
  const html = buildEmailHtml(studentName, setupUrl);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "【ドローンスクール】本登録のご案内",
    html,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
}
