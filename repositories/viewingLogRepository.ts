import { getPrisma } from "@/lib/db";
import { ViewingLog, Prisma } from "@prisma/client";

export interface CreateViewingLogInput {
  userId: string;
  videoId: string;
  startedAt: Date;
  endedAt: Date;
  watchedSeconds: number;
  rawLog?: Prisma.InputJsonValue;
}

export interface IViewingLogRepository {
  create(input: CreateViewingLogInput): Promise<ViewingLog>;
  findMaxWatchedSecondsByUserVideo(userId: string, videoId: string): Promise<number>;
  findLatestCreatedAtByUserVideo(userId: string, videoId: string): Promise<Date | null>;
  sumWatchedSecondsByUserSubject(userId: string, subjectId: string): Promise<number>;
}

export class ViewingLogRepository implements IViewingLogRepository {
  async create(input: CreateViewingLogInput): Promise<ViewingLog> {
    const prisma = getPrisma();
    return prisma.viewingLog.create({ data: input });
  }

  async findMaxWatchedSecondsByUserVideo(userId: string, videoId: string): Promise<number> {
    const prisma = getPrisma();
    const result = await prisma.viewingLog.aggregate({
      where: { userId, videoId },
      _max: { watchedSeconds: true },
    });
    return result._max.watchedSeconds ?? 0;
  }

  async findLatestCreatedAtByUserVideo(userId: string, videoId: string): Promise<Date | null> {
    const prisma = getPrisma();
    const log = await prisma.viewingLog.findFirst({
      where: { userId, videoId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return log?.createdAt ?? null;
  }

  async sumWatchedSecondsByUserSubject(userId: string, subjectId: string): Promise<number> {
    // 同ユーザー・同科目の動画ごとの最大視聴秒数を合算する
    // (rewatch でレコードが増えても二重カウントしない)
    const prisma = getPrisma();
    const grouped = await prisma.viewingLog.groupBy({
      by: ["videoId"],
      where: { userId, video: { subjectId } },
      _max: { watchedSeconds: true },
    });
    return grouped.reduce((sum, g) => sum + (g._max.watchedSeconds ?? 0), 0);
  }
}
