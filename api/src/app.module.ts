import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./modules/auth/auth.controller";
import { JwtGuard, RolesGuard } from "./modules/auth/auth.guards";
import { AuthService } from "./modules/auth/auth.service";
import {
  AdminCatalogController,
  CatalogController,
} from "./modules/catalog/catalog.controller";
import { CatalogService } from "./modules/catalog/catalog.service";
import { UploadController } from "./modules/catalog/upload.controller";
import {
  AdminOrdersController,
  OrdersController,
} from "./modules/orders/orders.controller";
import { OrdersService } from "./modules/orders/orders.service";
import { NotificationsController } from "./modules/notifications/notifications.controller";
import { NotificationsService } from "./modules/notifications/notifications.service";
import {
  AdminReviewsController,
  ReviewsController,
} from "./modules/reviews/reviews.controller";
import { ReviewsService } from "./modules/reviews/reviews.service";
import {
  AdminStoreController,
  StoreController,
} from "./modules/store/store.controller";
import { StoreService } from "./modules/store/store.service";
import { WhatsAppService } from "./modules/store/whatsapp.service";
import { PaymentsController } from "./modules/payments/payments.controller";
import { PaymentsService } from "./modules/payments/payments.service";
import {
  Ingredient,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Product,
  ProductReview,
  StoreSettings,
  User,
} from "./database/entities";
const entities = [
  User,
  Product,
  Ingredient,
  Order,
  OrderItem,
  OrderStatusHistory,
  Notification,
  StoreSettings,
  ProductReview,
];
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: "postgres",
        url: c.getOrThrow("DATABASE_URL"),
        entities,
        synchronize: c.get("DB_SYNC") === "true",
        ssl:
          c.get("NODE_ENV") === "production"
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow("JWT_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [
    AuthController,
    CatalogController,
    AdminCatalogController,
    UploadController,
    StoreController,
    AdminStoreController,
    OrdersController,
    AdminOrdersController,
    NotificationsController,
    ReviewsController,
    AdminReviewsController,
    PaymentsController,
  ],
  providers: [
    AuthService,
    CatalogService,
    OrdersService,
    NotificationsService,
    ReviewsService,
    PaymentsService,
    StoreService,
    WhatsAppService,
    JwtGuard,
    RolesGuard,
  ],
})
export class AppModule {}
