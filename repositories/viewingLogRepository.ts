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

// Service レイヤーがトランザクション境界を管理できるよう、
// 各メソッドはオプショナルでトランザクションクライアントを受け取る。
type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export interface IViewingLogRepository {
  create(input: CreateViewingLogInput, tx?: PrismaLike): Promise<ViewingLog>;
  findMaxWatchedSecondsByUserVideo(
    userId: string,
    videoId: string,
    tx?: PrismaLike
  ): Promise<number>;
  findMaxWatchedSecondsByUserVideos(
    userId: string,
    videoIds: string[],
    tx?: PrismaLike
  ): Promise<Record<string, number>>;
  findLatestCreatedAtByUserVideo(
    userId: string,
    videoId: string,
    tx?: PrismaLike
  ): Promise<Date | null>;
  sumWatchedSecondsByUserSubject(
    userId: string,
    subjectId: string,
    tx?: PrismaLike
  ): Promise<number>;
}

export class ViewingLogRepository implements IViewingLogRepository {
  async create(input: CreateViewingLogInput, tx?: PrismaLike): Promise<ViewingLog> {
    const prisma = tx ?? getPrisma();
    return prisma.viewingLog.create({ data: input });
  }

  async findMaxWatchedSecondsByUserVideo(
    userId: string,
    videoId: string,
    tx?: PrismaLike
  ): Promise<number> {
    const prisma = tx ?? getPrisma();
    const result = await prisma.viewingLog.aggregate({
      where: { userId, videoId },
      _max: { watchedSeconds: true },
    });
    return result._max.watchedSeconds ?? 0;
  }

  async findLatestCreatedAtByUserVideo(
    userId: string,
    videoId: string,
    tx?: PrismaLike
  ): Promise<Date | null> {
    const prisma = tx ?? getPrisma();
    const log = await prisma.viewingLog.findFirst({
      where: { userId, videoId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return log?.createdAt ?? null;
  }

  async findMaxWatchedSecondsByUserVideos(
    userId: string,
    videoIds: string[],
    tx?: PrismaLike
  ): Promise<Record<string, number>> {
    if (videoIds.length === 0) return {};
    const prisma = tx ?? getPrisma();
    const grouped = await prisma.viewingLog.groupBy({
      by: ["videoId"],
      where: { userId, videoId: { in: videoIds } },
      _max: { watchedSeconds: true },
    });
    const map: Record<string, number> = {};
    for (const g of grouped) {
      map[g.videoId] = g._max.watchedSeconds ?? 0;
    }
    return map;
  }

  async sumWatchedSecondsByUserSubject(
    userId: string,
    subjectId: string,
    tx?: PrismaLike
  ): Promise<number> {
    // 同ユーザー・同科目の動画ごとの最大視聴秒数を合算する
    // (rewatch でレコードが増えても二重カウントしない)
    const prisma = tx ?? getPrisma();
    const grouped = await prisma.viewingLog.groupBy({
      by: ["videoId"],
      where: { userId, video: { subjectId } },
      _max: { watchedSeconds: true },
    });
    return grouped.reduce((sum, g) => sum + (g._max.watchedSeconds ?? 0), 0);
  }
}
