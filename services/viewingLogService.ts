import type { ViewingLog } from "@prisma/client";
import type {
  IViewingLogRepository,
  CreateViewingLogInput,
} from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import { BusinessError, VideoNotFoundError } from "@/services/errors";
import { VIEWING_LOG_BUFFER_SECONDS } from "@/lib/constants";

// 進捗偽装防止: 1セッションで許容する watchedSeconds の増分上限。
// クライアントが 10 秒バッファで送る前提で、ネットワーク遅延を見込み 3 倍まで許容する。
const MAX_WATCHED_SECONDS_INCREMENT = VIEWING_LOG_BUFFER_SECONDS * 3;

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

    // 進捗偽装防止: 既存最大視聴秒数を一度に大幅に超える値は拒否
    const previousMax = await this.logRepo.findMaxWatchedSecondsByUserVideo(
      input.userId,
      input.videoId
    );
    if (input.watchedSeconds > previousMax + MAX_WATCHED_SECONDS_INCREMENT) {
      throw new BusinessError("視聴時間の増分が許容範囲を超えています");
    }

    return this.logRepo.create(input);
  }

  async getMaxWatchedSeconds(userId: string, videoId: string): Promise<number> {
    return this.logRepo.findMaxWatchedSecondsByUserVideo(userId, videoId);
  }
}
