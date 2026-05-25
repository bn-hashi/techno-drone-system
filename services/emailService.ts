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

/**
 * 招待メールの HTML 本文を生成する
 *
 * @param studentName - 受講者氏名 (XSS エスケープ済み)
 * @param setupUrl - セットアップページの URL (XSS エスケープ済み)
 * @returns HTML 文字列
 */
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

  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("環境変数 RESEND_FROM_ADDRESS が設定されていません");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { to, setupUrl, studentName } = params;
  const html = buildEmailHtml(studentName, setupUrl);

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "【ドローンスクール】本登録のご案内",
    html,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
}

export interface SendAnswerNotificationEmailParams {
  to: string;
  studentName: string;
  question: string;
  answer: string;
}

function buildAnswerEmailHtml(studentName: string, question: string, answer: string): string {
  const safeName = escapeHtml(studentName);
  const safeQuestion = escapeHtml(question);
  const safeAnswer = escapeHtml(answer);
  return `
<p>${safeName} 様</p>
<p>ご質問への回答が届きましたのでお知らせします。</p>
<p><strong>ご質問:</strong></p>
<p>${safeQuestion}</p>
<p><strong>回答:</strong></p>
<p>${safeAnswer}</p>
<p>追加のご質問がございましたら、受講者画面の質疑応答フォームよりお問い合わせください。</p>
<p>ドローンスクール事務局</p>
  `.trim();
}

/**
 * 質疑応答の回答通知メールを送信する
 *
 * @throws Resend からエラーが返された場合、または環境変数が未設定の場合
 */
export async function sendAnswerNotificationEmail(
  params: SendAnswerNotificationEmailParams
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 RESEND_API_KEY が設定されていません");
  }

  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("環境変数 RESEND_FROM_ADDRESS が設定されていません");
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { to, studentName, question, answer } = params;
  const html = buildAnswerEmailHtml(studentName, question, answer);

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "【ドローンスクール】ご質問への回答をお送りします",
    html,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
}
