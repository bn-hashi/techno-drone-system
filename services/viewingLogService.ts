import type { ViewingLog } from "@prisma/client";
import type {
  IViewingLogRepository,
  CreateViewingLogInput,
} from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import type { ISubjectProgressRepository } from "@/repositories/subjectProgressRepository";
import type { ICourseAccessService } from "@/services/courseAccessService";
import { runTransaction } from "@/lib/db";
import { BusinessError, VideoNotFoundError } from "@/services/errors";
import { VIEWING_LOG_BUFFER_SECONDS, MAX_PLAYBACK_RATE } from "@/lib/constants";

interface IVideoWatchChecker {
  canWatchVideo(userId: string, videoId: string): Promise<boolean>;
}

export class ViewingLogService {
  constructor(
    private readonly logRepo: IViewingLogRepository,
    private readonly videoRepo: IVideoRepository,
    private readonly subjectProgressRepo: ISubjectProgressRepository,
    private readonly courseAccessService: ICourseAccessService,
    private readonly watchChecker: IVideoWatchChecker
  ) {}

  async recordSession(input: CreateViewingLogInput): Promise<ViewingLog> {
    const video = await this.videoRepo.findById(input.videoId);
    if (video === null) {
      throw new VideoNotFoundError(input.videoId);
    }

    // IDOR 対策: videoId のコースへのアクセス権を確認する。存在秘匿のため VideoNotFoundError。
    const canAccess = await this.courseAccessService.canAccessCourse(input.userId, video.courseId);
    if (!canAccess) {
      throw new VideoNotFoundError(input.videoId);
    }

    // 未公開動画・順番視聴ロックも存在秘匿のため VideoNotFoundError。
    if (!video.isPublished) {
      throw new VideoNotFoundError(input.videoId);
    }
    const canWatch = await this.watchChecker.canWatchVideo(input.userId, input.videoId);
    if (!canWatch) {
      throw new VideoNotFoundError(input.videoId);
    }

    if (input.watchedSeconds < 0) {
      throw new BusinessError("視聴時間は0以上を指定してください");
    }
    if (input.watchedSeconds > video.duration) {
      throw new BusinessError("視聴時間が動画長を超えています");
    }
    if (input.startedAt > input.endedAt) {
      throw new BusinessError("開始時刻は終了時刻より前である必要があります");
    }

    // 進捗偽装防止: クライアント送信の startedAt/endedAt は信頼できないため、
    // サーバー側の前回ログ createdAt と現在時刻の差分を基準にする。
    // 初回ログは比較対象がないので「1 バッチ分 + バッファ余裕」を上限にする。
    const lastCreatedAt = await this.logRepo.findLatestCreatedAtByUserVideo(
      input.userId,
      input.videoId
    );
    const previousMax =
      (await this.logRepo.findMaxWatchedSecondsByUserVideo(input.userId, input.videoId)) ?? 0;
    const progressIncrement = input.watchedSeconds - previousMax;
    if (progressIncrement > 0) {
      const maxAllowedProgress =
        lastCreatedAt === null
          ? VIEWING_LOG_BUFFER_SECONDS * 2 // 初回上限: 1 バッチ送信幅 + ネットワーク遅延余裕
          : ((Date.now() - lastCreatedAt.getTime()) / 1000) * MAX_PLAYBACK_RATE +
            VIEWING_LOG_BUFFER_SECONDS;
      if (progressIncrement > maxAllowedProgress) {
        throw new BusinessError("実時間に対する進捗が許容範囲を超えています");
      }
    }

    // ViewingLog の保存と SubjectProgress の更新を 1 トランザクションで実行し、
    // どちらか一方だけが永続化される不整合状態を防ぐ。
    return runTransaction(async (tx) => {
      const log = await this.logRepo.create(input, tx);
      const totalSeconds = await this.logRepo.sumWatchedSecondsByUserSubject(
        input.userId,
        video.subjectId,
        tx
      );
      await this.subjectProgressRepo.upsert(
        {
          userId: input.userId,
          subjectId: video.subjectId,
          totalWatchedMinutes: Math.floor(totalSeconds / 60),
          // 充足判定は ProgressService で動的に行うため永続化値は常に false。
          isFulfilled: false,
        },
        tx
      );
      return log;
    });
  }

  async getMaxWatchedSeconds(userId: string, videoId: string): Promise<number> {
    return this.logRepo.findMaxWatchedSecondsByUserVideo(userId, videoId);
  }
}
