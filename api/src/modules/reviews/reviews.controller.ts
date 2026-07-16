import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "../../database/entities";
import { CurrentUser, JwtGuard, Roles, RolesGuard } from "../auth/auth.guards";
import { CreateReviewDto, ReviewsService } from "./reviews.service";
@UseGuards(JwtGuard)
@Controller("reviews")
export class ReviewsController {
  constructor(private service: ReviewsService) {}
  @Get("mine") mine(@CurrentUser() user: any) {
    return this.service.mine(user.sub);
  }
  @Post() create(@CurrentUser() user: any, @Body() dto: CreateReviewDto) {
    return this.service.create(user.sub, dto);
  }
}
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/reviews")
export class AdminReviewsController {
  constructor(private service: ReviewsService) {}
  @Get() all() {
    return this.service.all();
  }
}
