import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification } from "../../database/entities";
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}
  mine(id: string) {
    return this.repo.find({
      where: { user: { id } },
      order: { createdAt: "DESC" },
    });
  }
  async read(id: string, userId: string) {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({ read: true })
      .where('id=:id AND "userId"=:userId', { id, userId })
      .execute();
    return { success: true };
  }
}
