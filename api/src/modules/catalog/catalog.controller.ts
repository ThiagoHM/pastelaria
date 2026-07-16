import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductCategory, UserRole } from "../../database/entities";
import { JwtGuard, Roles, RolesGuard } from "../auth/auth.guards";
import { CatalogService, IngredientDto, ProductDto } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get("products") products(@Query("category") category?: ProductCategory) {
    return this.service.listProducts(category);
  }
  @Get("ingredients") ingredients() {
    return this.service.listIngredients();
  }
}

@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/catalog")
export class AdminCatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get("products") products() {
    return this.service.listProducts(undefined, true);
  }
  @Post("products") addProduct(@Body() dto: ProductDto) {
    return this.service.saveProduct(dto);
  }
  @Patch("products/:id") editProduct(
    @Param("id") id: string,
    @Body() dto: ProductDto,
  ) {
    return this.service.saveProduct(dto, id);
  }
  @Delete("products/:id") removeProduct(@Param("id") id: string) {
    return this.service.removeProduct(id);
  }
  @Get("ingredients") ingredients() {
    return this.service.listIngredients(true);
  }
  @Post("ingredients") addIngredient(@Body() dto: IngredientDto) {
    return this.service.saveIngredient(dto);
  }
  @Patch("ingredients/:id") editIngredient(
    @Param("id") id: string,
    @Body() dto: IngredientDto,
  ) {
    return this.service.saveIngredient(dto, id);
  }
  @Delete("ingredients/:id") removeIngredient(@Param("id") id: string) {
    return this.service.removeIngredient(id);
  }
}
