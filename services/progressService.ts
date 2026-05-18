import type { IViewingLogRepository } from "@/repositories/viewingLogRepository";
import type { IVideoRepository } from "@/repositories/videoRepository";
import type { ISubjectRepository } from "@/repositories/subjectRepository";
import { CourseType } from "@/types/prisma";
import { VIDEO_COMPLETION_THRESHOLD } from "@/lib/constants";

export interface SubjectProgressView {
  subjectId: string;
  subjectName: string;
  totalWatchedMinutes: number;
  requiredMinutes: number;
  isFulfilled: boolean;
}

export class ProgressService {
  constructor(
    private readonly logRepo: IViewingLogRepository,
    private readonly videoRepo: IVideoRepository,
    private readonly subjectRepo: ISubjectRepository
  ) {}

  async getProgressByUser(
    userId: string,
    courseType: CourseType
  ): Promise<SubjectProgressView[]> {
    const subjects = await this.subjectRepo.findAll();
    const result: SubjectProgressView[] = [];
    for (const subject of subjects) {
      const totalSeconds = await this.logRepo.sumWatchedSecondsByUserSubject(userId, subject.id);
      const totalWatchedMinutes = Math.floor(totalSeconds / 60);
      const requiredMinutes =
        courseType === CourseType.BEGINNER
          ? subject.requiredMinutesBeginner
          : subject.requiredMinutesExperienced;
      result.push({
        subjectId: subject.id,
        subjectName: subject.name,
        totalWatchedMinutes,
        requiredMinutes,
        isFulfilled: totalWatchedMinutes >= requiredMinutes,
      });
    }
    return result;
  }

  async canWatchVideo(userId: string, videoId: string): Promise<boolean> {
    const video = await this.videoRepo.findById(videoId);
    if (video === null) return false;
    if (video.sortOrder === 0) return true;

    // 同一コースで sortOrder が小さい全動画が完了しているか確認する
    const previousVideos = (
      await this.videoRepo.findAll({ courseId: video.courseId, isPublished: true })
    ).filter((v) => v.sortOrder < video.sortOrder);

    for (const prev of previousVideos) {
      const maxWatched = await this.logRepo.findMaxWatchedSecondsByUserVideo(userId, prev.id);
      if (maxWatched < prev.duration * VIDEO_COMPLETION_THRESHOLD) return false;
    }
    return true;
  }
}
