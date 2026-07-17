import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { In, Repository } from "typeorm";
import {
  Order,
  OrderStatus,
  ProductReview,
  User,
} from "../../database/entities";

export class CreateReviewDto {
  @IsUUID() orderItemId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview) private reviews: Repository<ProductReview>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  mine(userId: string) {
    return this.reviews.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async all() {
    const reviews = await this.reviews.find({ order: { createdAt: "DESC" } });
    const users = reviews.length
      ? await this.users.findBy({
          id: In([...new Set(reviews.map((review) => review.userId))]),
        })
      : [];
    const names = new Map(users.map((user) => [user.id, user.fullName]));
    return reviews.map((review) => ({
      ...review,
      userName: names.get(review.userId) || review.userName,
    }));
  }

  async create(userId: string, dto: CreateReviewDto) {
    const existing = await this.reviews.findOneBy({
      orderItemId: dto.orderItemId,
    });
    if (existing) throw new ConflictException("Este produto já foi avaliado");
    const order = await this.orders
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.user", "user")
      .leftJoinAndSelect("order.items", "item")
      .where("item.id = :itemId", { itemId: dto.orderItemId })
      .getOne();
    if (!order) throw new NotFoundException("Item do pedido não encontrado");
    if (order.user.id !== userId) throw new ForbiddenException();
    if (order.status !== OrderStatus.COMPLETED)
      throw new ForbiddenException(
        "A avaliação é liberada após a conclusão do pedido",
      );
    const item = order.items.find((value) => value.id === dto.orderItemId)!;
    return this.reviews.save(
      this.reviews.create({
        userId,
        userName: order.user.fullName,
        orderItemId: item.id,
        productId: item.productId,
        productName: item.name,
        rating: dto.rating,
        comment: dto.comment?.trim() || undefined,
      }),
    );
  }
}
