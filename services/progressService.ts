import type { Video } from "@prisma/client";
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

  async getProgressByUser(userId: string, courseType: CourseType): Promise<SubjectProgressView[]> {
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

    if (previousVideos.length === 0) return true;
    const maxMap = await this.logRepo.findMaxWatchedSecondsByUserVideos(
      userId,
      previousVideos.map((v) => v.id)
    );
    return previousVideos.every(
      (v) => (maxMap[v.id] ?? 0) >= v.duration * VIDEO_COMPLETION_THRESHOLD
    );
  }

  // 一覧画面用の一括判定: 同一コース内の全動画について 1 クエリで maxWatched を取得し
  // sortOrder 順に判定する。N+1 を回避するため canWatchVideo を動画数だけ呼ばない。
  async canWatchVideoBatch(userId: string, videos: Video[]): Promise<Record<string, boolean>> {
    if (videos.length === 0) return {};
    const sorted = [...videos].sort((a, b) => a.sortOrder - b.sortOrder);
    const maxMap = await this.logRepo.findMaxWatchedSecondsByUserVideos(
      userId,
      sorted.map((v) => v.id)
    );

    const result: Record<string, boolean> = {};
    let allPreviousCompleted = true;
    for (const v of sorted) {
      result[v.id] = v.sortOrder === 0 || allPreviousCompleted;
      const completed = (maxMap[v.id] ?? 0) >= v.duration * VIDEO_COMPLETION_THRESHOLD;
      allPreviousCompleted = allPreviousCompleted && completed;
    }
    return result;
  }
}
