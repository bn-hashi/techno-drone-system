import type { Exam, ExamAnswer, Question, Prisma } from "@prisma/client";
import type { IExamRepository, ExamWithUser } from "@/repositories/examRepository";
import type { IExamAnswerRepository } from "@/repositories/examAnswerRepository";
import type { IQuestionRepository } from "@/repositories/questionRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import type { SubjectProgressView } from "@/services/progressService";
import type { SafeUser } from "@/services/userManagementService";
import { getPrisma } from "@/lib/db";
import { BusinessError, NotFoundError } from "@/services/errors";
import { CourseType, ExamStatus, UserStatus } from "@/types/prisma";
import {
  DEFAULT_EXAM_QUESTION_COUNT,
  EXAM_DURATION_MINUTES,
  PASSING_SCORE_THRESHOLD,
} from "@/lib/constants";

/** ExamService が依存する ProgressService の最小契約 */
export interface ProgressServiceLike {
  getProgressByUser(userId: string, courseType: CourseType): Promise<SubjectProgressView[]>;
}

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

/** ExamService が依存する UserManagementService の最小契約 */
export interface UserManagementServiceLike {
  updateStatus(userId: string, newStatus: UserStatus, tx?: PrismaLike): Promise<SafeUser>;
  getUserById(id: string): Promise<SafeUser | null>;
}

export interface EligibilityResult {
  eligible: boolean;
  progress: SubjectProgressView[];
}

export interface ExamQuestionView {
  id: string;
  subjectId: string;
  body: string;
  choices: string[];
}

export interface ExamStartView {
  examId: string;
  startedAt: Date;
  durationMinutes: number;
  totalQuestions: number;
  questions: ExamQuestionView[];
}

export interface SubmitAnswerInput {
  questionId: string;
  selectedIndex: number;
}

export interface ExamResultView {
  exam: Exam;
  answers: ExamAnswer[];
}

/**
 * Fisher-Yates シャッフル。元配列を変更せず新配列を返す。
 */
function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class ExamService {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly answerRepo: IExamAnswerRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly subjectRepo: ISubjectRepository,
    private readonly progressService: ProgressServiceLike,
    private readonly userManagementService: UserManagementServiceLike
  ) {}

  async checkEligibility(userId: string, courseType: CourseType): Promise<EligibilityResult> {
    const progress = await this.progressService.getProgressByUser(userId, courseType);
    const eligible = progress.length > 0 && progress.every((p) => p.isFulfilled);
    return { eligible, progress };
  }

  async startExam(userId: string, courseType: CourseType): Promise<ExamStartView> {
    const eligibility = await this.checkEligibility(userId, courseType);
    if (!eligibility.eligible) {
      throw new BusinessError("試験を開始するには全科目の受講時間を満たす必要があります");
    }

    const inProgress = await this.examRepo.findByUserAndStatus(userId, ExamStatus.IN_PROGRESS);
    if (inProgress !== null) {
      throw new BusinessError("進行中の試験があります");
    }

    const subjects = await this.subjectRepo.findAll();
    if (subjects.length === 0) {
      throw new BusinessError("出題対象の科目が登録されていません");
    }

    const selected = await this.selectQuestions(
      subjects.map((s) => s.id),
      DEFAULT_EXAM_QUESTION_COUNT
    );
    if (selected.length === 0) {
      throw new BusinessError("出題できる問題がありません");
    }

    const exam = await this.examRepo.create({
      userId,
      totalQuestions: selected.length,
      questionIds: selected.map((q) => q.id),
    });

    return {
      examId: exam.id,
      startedAt: exam.startedAt,
      durationMinutes: EXAM_DURATION_MINUTES,
      totalQuestions: selected.length,
      questions: selected.map((q) => ({
        id: q.id,
        subjectId: q.subjectId,
        body: q.body,
        choices: q.choices as string[],
      })),
    };
  }

  async submitExam(userId: string, examId: string, answers: SubmitAnswerInput[]): Promise<Exam> {
    const exam = await this.examRepo.findById(examId);
    if (exam === null) {
      throw new NotFoundError("試験が見つかりません");
    }
    if (exam.userId !== userId) {
      throw new BusinessError("この試験を提出する権限がありません");
    }
    if (exam.status !== ExamStatus.IN_PROGRESS) {
      throw new BusinessError("この試験はすでに提出済みです");
    }

    // 提出時の改ざん検証:
    // 1. 出題セットに含まれない questionId を拒否
    // 2. 同じ questionId の重複回答を拒否 (正答数の水増し防止)
    const allowedIds = new Set<string>(
      Array.isArray(exam.questionIds) ? (exam.questionIds as string[]) : []
    );
    const seenIds = new Set<string>();
    for (const ans of answers) {
      if (!allowedIds.has(ans.questionId)) {
        throw new BusinessError("出題範囲外の問題が含まれています");
      }
      if (seenIds.has(ans.questionId)) {
        throw new BusinessError("同じ問題への重複回答は受け付けられません");
      }
      seenIds.add(ans.questionId);
    }

    const now = new Date();
    const elapsedMs = now.getTime() - exam.startedAt.getTime();
    const limitMs = EXAM_DURATION_MINUTES * 60 * 1000;
    const isTimedOut = elapsedMs > limitMs;

    const questionMap = new Map<string, Question>();
    for (const ans of answers) {
      if (questionMap.has(ans.questionId)) continue;
      const q = await this.questionRepo.findById(ans.questionId);
      if (q !== null) questionMap.set(ans.questionId, q);
    }

    let correctCount = 0;
    const answerInputs = answers.map((ans) => {
      const q = questionMap.get(ans.questionId);
      // 時間切れ時は全問不正解扱い（クライアントタイマー偽装対策）
      const isCorrect = !isTimedOut && q !== undefined && q.correctIndex === ans.selectedIndex;
      if (isCorrect) correctCount += 1;
      return {
        examId,
        questionId: ans.questionId,
        selectedIndex: ans.selectedIndex,
        isCorrect,
      };
    });

    const score = isTimedOut
      ? 0
      : Math.floor((correctCount / Math.max(exam.totalQuestions, 1)) * 100);
    const passed = score >= PASSING_SCORE_THRESHOLD;
    const nextStatus = passed ? ExamStatus.PASSED : ExamStatus.FAILED;

    // 合格時のステータス遷移要否を tx 開始前に判定する。
    // status の read は tx 外だが、書き込みは tx 内に取り込むことで
    // updateStatus 失敗時に exam.update と answer.createMany もロールバックされる。
    const userBeforeTx = passed ? await this.userManagementService.getUserById(userId) : null;
    // 既に EXAM_PASSED 以降の場合は遷移しない（再受験合格時の二重遷移防止）
    const shouldTransition =
      passed && userBeforeTx !== null && userBeforeTx.status === UserStatus.ACTIVE;

    const updated = await getPrisma().$transaction(async (tx) => {
      const u = await this.examRepo.update(
        examId,
        { score, passed, status: nextStatus, endedAt: now },
        tx
      );
      await this.answerRepo.createMany(answerInputs, tx);
      if (shouldTransition) {
        await this.userManagementService.updateStatus(userId, UserStatus.EXAM_PASSED, tx);
      }
      return u;
    });

    return updated;
  }

  async getExam(examId: string, userId: string): Promise<ExamResultView> {
    const exam = await this.examRepo.findById(examId);
    if (exam === null) {
      throw new NotFoundError("試験が見つかりません");
    }
    if (exam.userId !== userId) {
      throw new BusinessError("この試験を閲覧する権限がありません");
    }
    const answers = await this.answerRepo.findByExamId(examId);
    return { exam, answers };
  }

  async listAllResults(): Promise<ExamWithUser[]> {
    return this.examRepo.findAllWithUser();
  }

  async listResultsByUser(userId: string): Promise<Exam[]> {
    return this.examRepo.findByUserOrderByStartedAtDesc(userId);
  }

  /**
   * 科目均等配分で問題を抽選する。
   * 各科目から floor(want / 科目数) ずつ取得し、余りは全プールからランダム補完。
   * 取得可能数が want を下回る場合は取得できた分だけ返す。
   */
  private async selectQuestions(subjectIds: string[], want: number): Promise<Question[]> {
    const perSubject = Math.floor(want / subjectIds.length);
    const pool: Question[] = [];
    const usedIds = new Set<string>();

    for (const subjectId of subjectIds) {
      if (perSubject === 0) break;
      const subjectQs = shuffle(await this.questionRepo.findAll({ subjectId }));
      for (let i = 0; i < Math.min(perSubject, subjectQs.length); i++) {
        pool.push(subjectQs[i]);
        usedIds.add(subjectQs[i].id);
      }
    }

    const all = await this.questionRepo.findAll();
    const target = Math.min(want, all.length);

    if (pool.length < target) {
      const remaining = shuffle(all.filter((q) => !usedIds.has(q.id)));
      for (const q of remaining) {
        if (pool.length >= target) break;
        pool.push(q);
      }
    }

    return shuffle(pool);
  }
}
