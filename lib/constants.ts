/**
 * システム定数
 *
 * マジックナンバーを排除し、全定数をここに集約する。
 */

/** テクノドローン株式会社の登録講習機関コード */
export const INSTITUTION_CODE = "0515" as const;

/** 科目コード一覧 */
export const SUBJECT_CODES = ["SUBJECT_01", "SUBJECT_02", "SUBJECT_03", "SUBJECT_04"] as const;
export type SubjectCode = (typeof SUBJECT_CODES)[number];

/** 試験合格ライン（パーセント） */
export const PASSING_SCORE_THRESHOLD = 80;

/** 修了証明書有効年数 */
export const CERTIFICATE_VALIDITY_YEARS = 1;

/** 登録講習機関名 (修了証明書 様式1 記載) */
export const INSTITUTION_NAME = "テクノドローン株式会社" as const;

/** スクール名 (修了証明書 様式1 記載) */
export const SCHOOL_NAME = "テクノドローンスクール" as const;

/** 講習事務所コード (修了証明書 様式1 記載) */
export const TRAINING_OFFICE_CODE = "TC-0515-001" as const;

/** 修了審査員氏名のデフォルト (環境変数 EXAMINER_NAME 未設定時のフォールバック) */
export const DEFAULT_EXAMINER_NAME = "未設定" as const;

/** 修了証明書 PDF の保存先デフォルト (環境変数 CERTIFICATE_OUTPUT_DIR で上書き可能) */
export const CERTIFICATE_OUTPUT_DIR_DEFAULT = "/home/ubuntu/uploads/certificates/" as const;

/** 科目ごとの必須受講時間（分）*/
export const SUBJECT_REQUIRED_MINUTES = {
  SUBJECT_01: { BEGINNER: 180, EXPERIENCED: 60 },
  SUBJECT_02: { BEGINNER: 210, EXPERIENCED: 90 },
  SUBJECT_03: { BEGINNER: 120, EXPERIENCED: 60 },
  SUBJECT_04: { BEGINNER: 90, EXPERIENCED: 30 },
} as const;

/** デフォルト出題数 */
export const DEFAULT_EXAM_QUESTION_COUNT = 30;

/** 修了確認試験の制限時間（分） */
export const EXAM_DURATION_MINUTES = 30;

/** 動画再生速度上限 */
export const MAX_PLAYBACK_RATE = 1.5;

/** タブ離脱検知閾値（秒） */
export const TAB_LEAVE_THRESHOLD_SECONDS = 60;

/** 視聴ログ送信バッファ（秒） */
export const VIEWING_LOG_BUFFER_SECONDS = 10;

/** 動画完了とみなす視聴率（受講順序制御の判定基準） */
export const VIDEO_COMPLETION_THRESHOLD = 0.8;

/** 質疑応答 質問本文の最大文字数 */
export const QA_QUESTION_MAX_LENGTH = 2000;

/** 質疑応答 回答本文の最大文字数 */
export const QA_ANSWER_MAX_LENGTH = 2000;
