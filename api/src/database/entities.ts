import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  CUSTOMER = "CUSTOMER",
  ADMIN = "ADMIN",
}
export enum ProductCategory {
  PASTEL = "PASTEL",
  DRINK = "DRINK",
  DESSERT = "DESSERT",
  COMBO = "COMBO",
}
export enum IngredientType {
  FILLING = "FILLING",
  SAUCE = "SAUCE",
}
export enum OrderStatus {
  PENDING = "PENDING",
  PREPARING = "PREPARING",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  READY_FOR_PICKUP = "READY_FOR_PICKUP",
  DELAYED = "DELAYED",
  PROBLEM = "PROBLEM",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}
export enum FulfillmentType {
  DELIVERY = "DELIVERY",
  PICKUP = "PICKUP",
}
export enum PaymentMethod {
  PIX = "PIX",
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
}
export enum PaymentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  FAILED = "FAILED",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true }) email: string;
  @Column() fullName: string;
  @Column({ default: "" }) phone: string;
  @Column({ select: false }) passwordHash: string;
  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;
  @Column() cep: string;
  @Column() street: string;
  @Column() number: string;
  @Column({ nullable: true }) complement?: string;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Order, (o) => o.user) orders: Order[];
}

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() name: string;
  @Column({ type: "text" }) description: string;
  @Column({ type: "decimal", precision: 10, scale: 2 }) price: number;
  @Column({ type: "enum", enum: ProductCategory }) category: ProductCategory;
  @Column({ nullable: true }) imageUrl?: string;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("ingredients")
export class Ingredient {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true }) name: string;
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  additionalPrice: number;
  @Column({
    type: "enum",
    enum: IngredientType,
    default: IngredientType.FILLING,
  })
  type: IngredientType;
  @Column({ default: true }) active: boolean;
}

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true }) code: string;
  @ManyToOne(() => User, (u) => u.orders, { eager: true }) user: User;
  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;
  @Column({ type: "enum", enum: FulfillmentType })
  fulfillmentType: FulfillmentType;
  @Column({ type: "enum", enum: PaymentMethod }) paymentMethod: PaymentMethod;
  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;
  @Column({ nullable: true }) paymentProviderId?: string;
  @Column({ nullable: true }) paymentStatusDetail?: string;
  @Column({ type: "decimal", precision: 10, scale: 2 }) subtotal: number;
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  deliveryFee: number;
  @Column({ type: "decimal", precision: 10, scale: 2 }) total: number;
  @Column({ type: "text", nullable: true }) observation?: string;
  @Column({ type: "jsonb", nullable: true }) deliveryAddress?: Record<
    string,
    string
  >;
  @Column({ type: "jsonb", default: [] }) sauces: {
    id: string;
    name: string;
  }[];
  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true, eager: true })
  items: OrderItem[];
  @OneToMany(() => OrderStatusHistory, (h) => h.order, {
    cascade: true,
    eager: true,
  })
  history: OrderStatusHistory[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Order, (o) => o.items, { onDelete: "CASCADE" }) order: Order;
  @Column() name: string;
  @Column() productId: string;
  @Column({ type: "int" }) quantity: number;
  @Column({ type: "decimal", precision: 10, scale: 2 }) unitPrice: number;
  @Column({ type: "jsonb", default: [] }) ingredients: {
    id: string;
    name: string;
    additionalPrice: number;
  }[];
  @Column({ type: "decimal", precision: 10, scale: 2 }) total: number;
}

@Entity("order_status_history")
export class OrderStatusHistory {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Order, (o) => o.history, { onDelete: "CASCADE" })
  order: Order;
  @Column({ type: "enum", enum: OrderStatus }) status: OrderStatus;
  @CreateDateColumn() createdAt: Date;
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" }) user: User;
  @Column() title: string;
  @Column({ type: "text" }) message: string;
  @Column({ default: false }) read: boolean;
  @Column({ nullable: true }) orderId?: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity("product_reviews")
@Index(["orderItemId"], { unique: true })
export class ProductReview {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() userId: string;
  @Column({ default: "Cliente" }) userName: string;
  @Column() orderItemId: string;
  @Column() productId: string;
  @Column() productName: string;
  @Column({ type: "int" }) rating: number;
  @Column({ type: "text", nullable: true }) comment?: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity("store_settings")
export class StoreSettings {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ default: true }) isOpen: boolean;
  @Column({ type: "decimal", precision: 10, scale: 2, default: 5 })
  deliveryFee: number;
  @Column({ default: "Pastelaria aberta e recebendo pedidos" }) message: string;
  @UpdateDateColumn() updatedAt: Date;
}
