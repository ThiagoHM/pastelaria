import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtGuard } from "../auth/auth.guards";
import { PaymentsService, ProcessPaymentDto } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private service: PaymentsService) {}
  @UseGuards(JwtGuard)
  @Post("process")
  process(@CurrentUser() user: any, @Body() dto: ProcessPaymentDto) {
    return this.service.process(user, dto);
  }
  @Post("webhook")
  webhook(@Body() body: any) {
    return body?.data?.id
      ? this.service.refresh(String(body.data.id))
      : { ok: true };
  }
  @Get(":id/refresh")
  refresh(@Param("id") id: string) {
    return this.service.refresh(id);
  }
}
