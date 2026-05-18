import type { ViewingLog } from "@prisma/client";
import type {
  IViewingLogRepository,
  CreateViewingLogInput,
} from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import { BusinessError, VideoNotFoundError } from "@/services/errors";
import { VIEWING_LOG_BUFFER_SECONDS, MAX_PLAYBACK_RATE } from "@/lib/constants";

export class ViewingLogService {
  constructor(
    private readonly logRepo: IViewingLogRepository,
    private readonly videoRepo: IVideoRepository
  ) {}

  async recordSession(input: CreateViewingLogInput): Promise<ViewingLog> {
    const video = await this.videoRepo.findById(input.videoId);
    if (video === null) {
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
    // 初回ログは比較対象がないので watchedSeconds <= video.duration のみで防御。
    const lastCreatedAt = await this.logRepo.findLatestCreatedAtByUserVideo(
      input.userId,
      input.videoId
    );
    if (lastCreatedAt !== null) {
      const previousMax = await this.logRepo.findMaxWatchedSecondsByUserVideo(
        input.userId,
        input.videoId
      );
      const progressIncrement = input.watchedSeconds - previousMax;
      if (progressIncrement > 0) {
        const elapsedServerSeconds = (Date.now() - lastCreatedAt.getTime()) / 1000;
        const maxAllowedProgress =
          elapsedServerSeconds * MAX_PLAYBACK_RATE + VIEWING_LOG_BUFFER_SECONDS;
        if (progressIncrement > maxAllowedProgress) {
          throw new BusinessError("実時間に対する進捗が許容範囲を超えています");
        }
      }
    }

    return this.logRepo.create(input);
  }

  async getMaxWatchedSeconds(userId: string, videoId: string): Promise<number> {
    return this.logRepo.findMaxWatchedSecondsByUserVideo(userId, videoId);
  }
}
