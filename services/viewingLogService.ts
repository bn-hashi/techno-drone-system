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

    // 進捗偽装防止: ウォール時刻に対する進捗増分が物理的に不可能な値を拒否する。
    // 連続して上限ぎりぎりを送る累積攻撃を、サーバー側の壁時計で抑止する。
    // 上限 = 実時間秒 × 再生速度上限 + バッファ（ネットワーク遅延・端末時刻ズレ吸収）
    const previousMax = await this.logRepo.findMaxWatchedSecondsByUserVideo(
      input.userId,
      input.videoId
    );
    const wallSeconds = (input.endedAt.getTime() - input.startedAt.getTime()) / 1000;
    const progressIncrement = input.watchedSeconds - previousMax;
    const maxAllowedProgress = wallSeconds * MAX_PLAYBACK_RATE + VIEWING_LOG_BUFFER_SECONDS;
    if (progressIncrement >= maxAllowedProgress) {
      throw new BusinessError("実時間に対する進捗が許容範囲を超えています");
    }

    return this.logRepo.create(input);
  }

  async getMaxWatchedSeconds(userId: string, videoId: string): Promise<number> {
    return this.logRepo.findMaxWatchedSecondsByUserVideo(userId, videoId);
  }
}
