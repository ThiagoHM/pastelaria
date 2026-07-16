import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "../../database/entities";
import { JwtGuard, Roles, RolesGuard } from "../auth/auth.guards";
import { SettingsDto, StoreService } from "./store.service";
@Controller("store")
export class StoreController {
  constructor(private service: StoreService) {}
  @Get("settings") get() {
    return this.service.get();
  }
}
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/store")
export class AdminStoreController {
  constructor(private service: StoreService) {}
  @Patch("settings") update(@Body() dto: SettingsDto) {
    return this.service.update(dto);
  }
}
