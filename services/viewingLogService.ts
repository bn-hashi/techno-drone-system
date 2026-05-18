import type { ViewingLog } from "@prisma/client";
import type {
  IViewingLogRepository,
  CreateViewingLogInput,
} from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

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

    return this.logRepo.create(input);
  }

  async getMaxWatchedSeconds(userId: string, videoId: string): Promise<number> {
    return this.logRepo.findMaxWatchedSecondsByUserVideo(userId, videoId);
  }
}
