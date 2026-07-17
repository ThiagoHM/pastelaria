import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "../../database/entities";
import { CurrentUser, JwtGuard, Roles, RolesGuard } from "../auth/auth.guards";
import { CreateOrderDto, InPersonPaymentDto, OrdersService, StatusDto } from "./orders.service";
@UseGuards(JwtGuard)
@Controller("orders")
export class OrdersController {
  constructor(private service: OrdersService) {}
  @Post() create(@CurrentUser() u: any, @Body() dto: CreateOrderDto) {
    return this.service.create(u.sub, dto);
  }
  @Get("mine") mine(@CurrentUser() u: any) {
    return this.service.mine(u.sub);
  }
  @Get(":id") one(@Param("id") id: string, @CurrentUser() u: any) {
    return this.service.byId(id, u);
  }
}
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private service: OrdersService) {}
  @Get() all() {
    return this.service.all();
  }
  @Post("in-person") createInPerson(
    @CurrentUser() user: any,
    @Body() dto: CreateOrderDto,
  ) {
    return this.service.createInPerson(user.sub, dto);
  }
  @Patch(":id/payment") payment(
    @Param("id") id: string,
    @Body() dto: InPersonPaymentDto,
  ) {
    return this.service.inPersonPayment(id, dto.status);
  }
  @Patch(":id/status") status(@Param("id") id: string, @Body() dto: StatusDto) {
    return this.service.status(id, dto.status);
  }
}
