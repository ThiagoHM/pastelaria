import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtGuard } from "../auth/auth.guards";
import { NotificationsService } from "./notifications.service";
@UseGuards(JwtGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private service: NotificationsService) {}
  @Get() mine(@CurrentUser() u: any) {
    return this.service.mine(u.sub);
  }
  @Patch(":id/read") read(@Param("id") id: string, @CurrentUser() u: any) {
    return this.service.read(id, u.sub);
  }
}
