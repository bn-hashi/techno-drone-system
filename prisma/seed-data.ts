/**
 * シードデータ定義
 *
 * seed.ts から分離し、テスト可能なモジュールとして定義する。
 * make seed は冪等に実行できる。
 */

import { UserRole, CourseType } from "@/types/prisma";

// ===========================
// 管理者アカウント
// ===========================

export const SEED_ADMIN = {
  email: "admin@techno-drone.jp",
  name: "テクノドローン管理者",
  role: UserRole.ADMIN,
  passwordHash: "", // seed.ts で bcrypt ハッシュ化して設定
} as const;

// ===========================
// 4科目マスタ
// ===========================

export const SEED_SUBJECTS = [
  {
    code: "SUBJECT_01",
    name: "無人航空機に関する規則（心構えを含む）",
    requiredMinutesBeginner: 180,
    requiredMinutesExperienced: 60,
  },
  {
    code: "SUBJECT_02",
    name: "無人航空機のシステム",
    requiredMinutesBeginner: 210,
    requiredMinutesExperienced: 90,
  },
  {
    code: "SUBJECT_03",
    name: "無人航空機の操縦者及び運航体制",
    requiredMinutesBeginner: 120,
    requiredMinutesExperienced: 60,
  },
  {
    code: "SUBJECT_04",
    name: "運航上のリスク管理",
    requiredMinutesBeginner: 90,
    requiredMinutesExperienced: 30,
  },
] as const;

// ===========================
// サンプルコース
// ===========================

export const SEED_COURSE = {
  name: "二等無人航空機操縦士学科コース（初学者）",
  type: CourseType.BEGINNER,
} as const;

// ===========================
// 試験問題（5問）
// ===========================

export const SEED_QUESTIONS = [
  {
    subjectCode: "SUBJECT_01",
    body: "無人航空機を飛行させる際に、航空法上の飛行禁止空域として正しいものはどれか。",
    choices: [
      "空港周辺の上空 (進入表面等の内側)",
      "人口集中地区の上空",
      "地表または水面から150m以上の高さの空域",
    ],
    correctIndex: 0,
    explanation:
      "航空法第132条の2により、空港周辺は飛行禁止空域に指定されている。人口集中地区および150m以上の空域は許可申請が必要な飛行形態。",
  },
  {
    subjectCode: "SUBJECT_01",
    body: "無人航空機の操縦者が遵守すべき「飛行の方法」として誤っているものはどれか。",
    choices: [
      "日中（日出から日没まで）に飛行させること",
      "目視外飛行は許可なく実施できる",
      "アルコールを摂取した状態で操縦してはならない",
    ],
    correctIndex: 1,
    explanation:
      "目視外飛行は国土交通大臣の許可が必要。その他の選択肢は正しい飛行方法の記述である。",
  },
  {
    subjectCode: "SUBJECT_02",
    body: "マルチローター型無人航空機の飛行制御システムに関する説明として正しいものはどれか。",
    choices: [
      "フライトコントローラーは各モーターの回転数を独立制御する",
      "ESCは受信機と直接通信してサーボを制御する",
      "GPSモジュールは高度のみを制御する",
    ],
    correctIndex: 0,
    explanation:
      "フライトコントローラー（FC）は各ESCを通じて各モーターの回転数を独立制御し、機体の姿勢・位置を安定させる。",
  },
  {
    subjectCode: "SUBJECT_03",
    body: "無人航空機の運航管理体制における「機体の整備責任者」の役割として正しいものはどれか。",
    choices: [
      "飛行計画の承認",
      "機体の点検・整備記録の管理",
      "飛行区域の設定",
    ],
    correctIndex: 1,
    explanation:
      "整備責任者は機体の点検・整備を実施し、記録を管理する責任を持つ。飛行計画の承認や区域設定は運航管理者の役割。",
  },
  {
    subjectCode: "SUBJECT_04",
    body: "無人航空機の飛行前のリスク評価において確認すべき事項として最も重要なものはどれか。",
    choices: [
      "機体の色",
      "気象条件（風速・視程・雲高）の確認",
      "操縦者の服装",
    ],
    correctIndex: 1,
    explanation:
      "飛行前のリスク評価では、強風・低視程・低い雲底などの気象条件が安全飛行に直結するため、気象確認が最重要事項である。",
  },
] as const;
