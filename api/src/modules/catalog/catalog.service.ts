import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Repository } from "typeorm";
import {
  Ingredient,
  IngredientType,
  Product,
  ProductCategory,
} from "../../database/entities";

export class ProductDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(500) description: string;
  @IsNumber() @Min(0) price: number;
  @IsEnum(ProductCategory) category: ProductCategory;
  @IsOptional() @IsString() @MaxLength(1000) imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class IngredientDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsNumber() @Min(0) additionalPrice: number;
  @IsEnum(IngredientType) type: IngredientType;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
  ) {}

  listProducts(category?: ProductCategory, admin = false) {
    return this.products.find({
      where: {
        ...(category ? { category } : {}),
        ...(!admin ? { active: true } : {}),
      },
      order: { name: "ASC" },
    });
  }

  saveProduct(dto: ProductDto, id?: string) {
    return this.products.save(
      this.products.create({ ...dto, ...(id ? { id } : {}) }),
    );
  }

  async removeProduct(id: string) {
    const result = await this.products.delete(id);
    if (!result.affected) throw new NotFoundException("Produto não encontrado");
    return { success: true };
  }

  listIngredients(admin = false) {
    return this.ingredients.find({
      where: admin ? {} : { active: true },
      order: { name: "ASC" },
    });
  }

  saveIngredient(dto: IngredientDto, id?: string) {
    return this.ingredients.save(
      this.ingredients.create({ ...dto, ...(id ? { id } : {}) }),
    );
  }

  async removeIngredient(id: string) {
    await this.ingredients.update(id, { active: false });
    return { success: true };
  }
}
