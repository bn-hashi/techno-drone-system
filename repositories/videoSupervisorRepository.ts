import { getPrisma } from "@/lib/db";
import { VideoSupervisor } from "@prisma/client";

export interface CreateSupervisorInput {
  videoId: string;
  name: string;
  instructorRegistrationNumber: string;
}

export interface UpdateSupervisorInput {
  name?: string;
  instructorRegistrationNumber?: string;
}

export interface IVideoSupervisorRepository {
  findByVideoId(videoId: string): Promise<VideoSupervisor[]>;
  findById(id: string): Promise<VideoSupervisor | null>;
  create(data: CreateSupervisorInput): Promise<VideoSupervisor>;
  update(id: string, data: UpdateSupervisorInput): Promise<VideoSupervisor>;
  delete(id: string): Promise<void>;
}

export class VideoSupervisorRepository implements IVideoSupervisorRepository {
  async findByVideoId(videoId: string): Promise<VideoSupervisor[]> {
    const prisma = getPrisma();
    return prisma.videoSupervisor.findMany({ where: { videoId } });
  }

  async findById(id: string): Promise<VideoSupervisor | null> {
    const prisma = getPrisma();
    return prisma.videoSupervisor.findUnique({ where: { id } });
  }

  async create(data: CreateSupervisorInput): Promise<VideoSupervisor> {
    const prisma = getPrisma();
    return prisma.videoSupervisor.create({ data });
  }

  async update(id: string, data: UpdateSupervisorInput): Promise<VideoSupervisor> {
    const prisma = getPrisma();
    return prisma.videoSupervisor.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.videoSupervisor.delete({ where: { id } });
  }
}
