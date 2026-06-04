import type { Question } from "@prisma/client";
import type {
  IQuestionRepository,
  QuestionFilter,
  CreateQuestionInput,
  UpdateQuestionInput,
} from "@/repositories/questionRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { getPrisma } from "@/lib/db";
import { BusinessError, QuestionNotFoundError } from "@/services/errors";
import { parseCsv, CsvParseError } from "@/lib/csvParser";

const REQUIRED_CHOICE_COUNT = 3;
const CSV_HEADERS = [
  "subjectCode",
  "body",
  "choice1",
  "choice2",
  "choice3",
  "correctIndex",
  "explanation",
] as const;

export interface ImportResult {
  imported: number;
  skipped: number;
}

function validateBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed === "") {
    throw new BusinessError("問題文は必須です");
  }
  return trimmed;
}

function validateChoices(choices: string[]): string[] {
  if (choices.length !== REQUIRED_CHOICE_COUNT) {
    throw new BusinessError(`選択肢は ${REQUIRED_CHOICE_COUNT} 個必要です`);
  }
  return choices;
}

function validateCorrectIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= REQUIRED_CHOICE_COUNT) {
    throw new BusinessError(`正答番号は 0 〜 ${REQUIRED_CHOICE_COUNT - 1} の整数です`);
  }
  return index;
}

export class QuestionService {
  constructor(
    private readonly questionRepo: IQuestionRepository,
    private readonly subjectRepo: ISubjectRepository
  ) {}

  async listQuestions(filter?: QuestionFilter): Promise<Question[]> {
    return this.questionRepo.findAll(filter);
  }

  async getQuestion(id: string): Promise<Question> {
    const question = await this.questionRepo.findById(id);
    if (question === null) {
      throw new QuestionNotFoundError(id);
    }
    return question;
  }

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    const subject = await this.subjectRepo.findById(input.subjectId);
    if (subject === null) {
      throw new BusinessError("指定された科目が見つかりません");
    }
    const body = validateBody(input.body);
    validateChoices(input.choices);
    validateCorrectIndex(input.correctIndex);

    return this.questionRepo.create({ ...input, body });
  }

  async updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question> {
    const existing = await this.questionRepo.findById(id);
    if (existing === null) {
      throw new QuestionNotFoundError(id);
    }
    // subjectId が指定された場合は存在チェック (createQuestion と一貫)
    if (input.subjectId !== undefined) {
      const subject = await this.subjectRepo.findById(input.subjectId);
      if (subject === null) {
        throw new BusinessError("指定された科目が見つかりません");
      }
    }
    const normalized: UpdateQuestionInput = { ...input };
    if (input.body !== undefined) normalized.body = validateBody(input.body);
    if (input.choices !== undefined) validateChoices(input.choices);
    if (input.correctIndex !== undefined) validateCorrectIndex(input.correctIndex);

    return this.questionRepo.update(id, normalized);
  }

  async deleteQuestion(id: string): Promise<void> {
    const existing = await this.questionRepo.findById(id);
    if (existing === null) {
      throw new QuestionNotFoundError(id);
    }
    await this.questionRepo.delete(id);
  }

  /**
   * CSV テキストをパースして問題を一括登録する。
   * - 全行が有効でなければ all-or-nothing でロールバック
   * - 同 subjectId + body の問題は skip（冪等性）
   * - エラー時は行番号付き BusinessError をスロー
   */
  async importFromCsv(csvText: string): Promise<ImportResult> {
    let rows: Record<string, string>[];
    try {
      rows = parseCsv(csvText, CSV_HEADERS);
    } catch (err) {
      if (err instanceof CsvParseError) {
        throw new BusinessError(err.message);
      }
      throw err;
    }

    // subjectCode → subjectId の解決マップを作成（1 クエリ）
    const subjects = await this.subjectRepo.findAll();
    const codeToId = new Map(subjects.map((s) => [s.code, s.id]));

    // 全行を事前バリデーション。1 行でも失敗したら DB に触れない。
    const inputs: CreateQuestionInput[] = [];
    rows.forEach((row, idx) => {
      const lineNumber = idx + 2; // 行 1 はヘッダー
      const subjectId = codeToId.get(row.subjectCode);
      if (subjectId === undefined) {
        throw new BusinessError(`line ${lineNumber}: 不明な科目コード ${row.subjectCode}`);
      }
      const body = row.body.trim();
      if (body === "") {
        throw new BusinessError(`line ${lineNumber}: 問題文が空です`);
      }
      const choices = [row.choice1, row.choice2, row.choice3];
      const correctIndex1Based = Number(row.correctIndex);
      if (
        !Number.isInteger(correctIndex1Based) ||
        correctIndex1Based < 1 ||
        correctIndex1Based > REQUIRED_CHOICE_COUNT
      ) {
        throw new BusinessError(
          `line ${lineNumber}: 正答番号は 1〜${REQUIRED_CHOICE_COUNT} で指定してください`
        );
      }
      inputs.push({
        subjectId,
        body,
        choices,
        correctIndex: correctIndex1Based - 1, // 1-based → 0-based
        explanation: row.explanation,
      });
    });

    // 重複スキップと挿入を 1 トランザクションで実行（all-or-nothing）
    let imported = 0;
    let skipped = 0;
    await getPrisma().$transaction(async (tx) => {
      for (const input of inputs) {
        const existing = await this.questionRepo.findBySubjectAndBody(
          input.subjectId,
          input.body,
          tx
        );
        if (existing !== null) {
          skipped += 1;
          continue;
        }
        await this.questionRepo.create(input, tx);
        imported += 1;
      }
    });

    return { imported, skipped };
  }
}
