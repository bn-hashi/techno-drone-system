import type { Video, VideoSupervisor } from "@prisma/client";
import type { IVideoRepository, VideoFilter, CreateVideoInput, UpdateVideoInput } from "@/repositories/videoRepository";
import type { IVideoSupervisorRepository } from "@/repositories/videoSupervisorRepository";
import { BusinessError, VideoNotFoundError, SupervisorNotFoundError } from "@/services/errors";

export interface AddSupervisorInput {
  name: string;
  instructorRegistrationNumber: string;
}

export interface UpdateSupervisorInput {
  name?: string;
  instructorRegistrationNumber?: string;
}

export class VideoService {
  constructor(
    private readonly videoRepo: IVideoRepository,
    private readonly supervisorRepo: IVideoSupervisorRepository
  ) {}

  async listVideos(filter?: VideoFilter): Promise<Video[]> {
    return this.videoRepo.findAll(filter);
  }

  async getVideo(id: string): Promise<Video> {
    const video = await this.videoRepo.findById(id);
    if (video === null) {
      throw new VideoNotFoundError(id);
    }
    return video;
  }

  async createVideo(data: CreateVideoInput): Promise<Video> {
    if (data.title.trim() === "") {
      throw new BusinessError("動画タイトルは必須です");
    }
    if (data.duration <= 0) {
      throw new BusinessError("動画時間は1秒以上を指定してください");
    }
    return this.videoRepo.create(data);
  }

  async updateVideo(id: string, data: UpdateVideoInput): Promise<Video> {
    const video = await this.videoRepo.findByIdWithSupervisors(id);
    if (video === null) {
      throw new VideoNotFoundError(id);
    }

    if (data.isPublished === true && video.supervisors.length === 0) {
      throw new BusinessError("監修者が登録されていない動画は公開できません");
    }

    return this.videoRepo.update(id, data);
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.videoRepo.findById(id);
    if (video === null) {
      throw new VideoNotFoundError(id);
    }
    await this.videoRepo.delete(id);
  }

  async addSupervisor(videoId: string, data: AddSupervisorInput): Promise<VideoSupervisor> {
    if (data.name.trim() === "") {
      throw new BusinessError("監修者名は必須です");
    }

    const video = await this.videoRepo.findById(videoId);
    if (video === null) {
      throw new VideoNotFoundError(videoId);
    }

    return this.supervisorRepo.create({ videoId, ...data });
  }

  async updateSupervisor(
    supervisorId: string,
    data: UpdateSupervisorInput
  ): Promise<VideoSupervisor> {
    const supervisor = await this.supervisorRepo.findById(supervisorId);
    if (supervisor === null) {
      throw new SupervisorNotFoundError(supervisorId);
    }
    return this.supervisorRepo.update(supervisorId, data);
  }

  async removeSupervisor(supervisorId: string): Promise<void> {
    const supervisor = await this.supervisorRepo.findById(supervisorId);
    if (supervisor === null) {
      throw new SupervisorNotFoundError(supervisorId);
    }

    const video = await this.videoRepo.findByIdWithSupervisors(supervisor.videoId);
    if (video !== null && video.isPublished && video.supervisors.length === 1) {
      throw new BusinessError("公開中の動画から最後の監修者を削除することはできません");
    }

    await this.supervisorRepo.delete(supervisorId);
  }
}
