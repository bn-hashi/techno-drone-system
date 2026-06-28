import type { IUserRepository } from "@/repositories/userRepository";
import type { ICourseRepository } from "@/repositories/courseRepository";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

export interface ICourseAccessService {
  /**
   * 指定ユーザーが指定コースにアクセスできるか判定する。
   *
   * 基礎コース認可条件:
   *   - User が存在する
   *   - role === STUDENT かつ status === ACTIVE
   *   - User.courseType != null
   *   - Course が存在する
   *   - Course.type === User.courseType
   *
   * 認可できない場合は false を返す。Course や User の存在有無を呼び出し元へ漏らさない。
   * Repository 例外は握り潰さず伝播させる。
   */
  canAccessCourse(userId: string, courseId: string): Promise<boolean>;
}

export class CourseAccessService implements ICourseAccessService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly courseRepo: ICourseRepository
  ) {}

  async canAccessCourse(userId: string, courseId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user) return false;
    if (user.role !== UserRole.STUDENT) return false;
    if (user.status !== UserStatus.ACTIVE) return false;
    if (!user.courseType) return false;

    const course = await this.courseRepo.findById(courseId);
    if (!course) return false;

    // Defensive guard: Course.type will become nullable in M4 when LIMITED_REMOVAL
    // category is introduced. Without this, null === null would incorrectly grant access.
    const courseType = course.type as CourseType | null;
    if (!courseType) return false;

    return courseType === user.courseType;
  }
}
