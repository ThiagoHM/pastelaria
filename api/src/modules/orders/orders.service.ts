import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Repository } from "typeorm";
import {
  FulfillmentType,
  Ingredient,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  PaymentMethod,
  PaymentStatus,
  Product,
  StoreSettings,
  User,
  UserRole,
} from "../../database/entities";
import { WhatsAppService } from "../store/whatsapp.service";

class OrderItemDto {
  @IsUUID() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsArray() @ArrayMaxSize(50) @IsUUID(undefined, { each: true }) ingredientIds: string[] = [];
}
class DeliveryAddressDto {
  @IsString() @MaxLength(10) cep: string;
  @IsString() @MaxLength(160) street: string;
  @IsString() @MaxLength(20) number: string;
  @IsOptional() @IsString() @MaxLength(120) complement?: string;
}
export class CreateOrderDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsEnum(FulfillmentType) fulfillmentType: FulfillmentType;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(500) observation?: string;
  @IsOptional() @ValidateNested() @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID(undefined, { each: true }) sauceIds: string[] = [];
}
export class StatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
}
export class InPersonPaymentDto {
  @IsEnum(PaymentStatus) status: PaymentStatus;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Ingredient) private ingredients: Repository<Ingredient>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Notification)
    private notifications: Repository<Notification>,
    @InjectRepository(StoreSettings)
    private settings: Repository<StoreSettings>,
    private whatsapp: WhatsAppService,
  ) {}
  async create(userId: string, dto: CreateOrderDto, inPerson = false) {
    const user = await this.users.findOneByOrFail({ id: userId });
    const store = await this.settings.findOne({ where: {} });
    if (dto.paymentMethod === PaymentMethod.IN_PERSON && !inPerson)
      throw new BadRequestException("Pagamento presencial disponível apenas para administradores");
    if (store && !store.isOpen && !inPerson)
      throw new Error("A Pastelaria Recanto está fechada no momento");
    const items: OrderItem[] = [];
    const sauces = dto.sauceIds?.length
      ? await this.ingredients
          .createQueryBuilder("i")
          .where("i.id IN (:...ids)", { ids: dto.sauceIds })
          .andWhere("i.active=true")
          .andWhere("i.type='SAUCE'")
          .getMany()
      : [];
    let subtotal = 0;
    for (const input of dto.items) {
      const p = await this.products.findOneBy({
        id: input.productId,
        active: true,
      });
      if (!p) throw new NotFoundException("Produto indisponível");
      const ings = input.ingredientIds.length
        ? await this.ingredients
            .createQueryBuilder("i")
            .where("i.id IN (:...ids)", { ids: input.ingredientIds })
            .andWhere("i.active=true")
            .getMany()
        : [];
      const unit =
        Number(p.price) +
        ings.reduce((s, i) => s + Number(i.additionalPrice), 0);
      const total = unit * input.quantity;
      subtotal += total;
      items.push(
        Object.assign(new OrderItem(), {
          name: p.name,
          productId: p.id,
          quantity: input.quantity,
          unitPrice: unit,
          total,
          ingredients: ings.map((i) => ({
            id: i.id,
            name: i.name,
            additionalPrice: Number(i.additionalPrice),
          })),
        }),
      );
    }
    subtotal += sauces.reduce(
      (sum, sauce) => sum + Number(sauce.additionalPrice),
      0,
    );
    const deliveryFee =
      dto.fulfillmentType === FulfillmentType.DELIVERY
        ? Number(store?.deliveryFee || 5)
        : 0;
    const deliveryAddress: Record<string, string> | undefined =
      dto.fulfillmentType === FulfillmentType.DELIVERY
        ? {
            cep: dto.deliveryAddress?.cep || user.cep,
            street: dto.deliveryAddress?.street || user.street,
            number: dto.deliveryAddress?.number || user.number,
            complement: dto.deliveryAddress?.complement || user.complement || "",
          }
        : undefined;
    const order = this.orders.create({
      code: `REC-${Date.now().toString().slice(-6)}`,
      user,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      fulfillmentType: dto.fulfillmentType,
      paymentMethod: dto.paymentMethod,
      observation: dto.observation,
      sauces: sauces.map((s) => ({ id: s.id, name: s.name })),
      deliveryAddress,
      history: [
        Object.assign(new OrderStatusHistory(), {
          status: OrderStatus.PENDING,
        }),
      ],
    });
    return this.orders.save(order);
  }
  mine(userId: string) {
    return this.orders.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });
  }
  all() {
    return this.orders.find({
      where: [
        { paymentStatus: PaymentStatus.APPROVED },
        { paymentMethod: PaymentMethod.IN_PERSON },
      ],
      order: { createdAt: "DESC" },
    });
  }
  createInPerson(adminId: string, dto: CreateOrderDto) {
    return this.create(adminId, {
      ...dto,
      fulfillmentType: FulfillmentType.PICKUP,
      paymentMethod: PaymentMethod.IN_PERSON,
      deliveryAddress: undefined,
    }, true);
  }
  async inPersonPayment(id: string, status: PaymentStatus) {
    if (![PaymentStatus.PENDING, PaymentStatus.APPROVED].includes(status))
      throw new BadRequestException("Status de pagamento inválido");
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException();
    if (order.paymentMethod !== PaymentMethod.IN_PERSON)
      throw new BadRequestException("Este pedido não é presencial");
    order.paymentStatus = status;
    order.paymentStatusDetail = status === PaymentStatus.APPROVED
      ? "Pago no estabelecimento"
      : "Pagamento pendente no estabelecimento";
    return this.orders.save(order);
  }
  async byId(id: string, user: { sub: string; role: UserRole }) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order || (user.role !== UserRole.ADMIN && order.user.id !== user.sub))
      throw new NotFoundException();
    return order;
  }
  async status(id: string, status: OrderStatus) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException();
    order.status = status;
    order.history.push(Object.assign(new OrderStatusHistory(), { status }));
    const messages: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.PREPARING]: "Seu pedido está em preparação.",
      [OrderStatus.OUT_FOR_DELIVERY]: "Seu pedido saiu para entrega!",
      [OrderStatus.READY_FOR_PICKUP]: "Seu pedido está pronto para retirada.",
      [OrderStatus.DELAYED]:
        "Seu pedido está atrasado. Estamos trabalhando para entregá-lo o quanto antes.",
      [OrderStatus.PROBLEM]:
        "Identificamos um problema com o pedido. A Pastelaria Recanto entrará em contato.",
      [OrderStatus.COMPLETED]: "Pedido concluído. Bom apetite!",
    };
    if (messages[status])
      await this.notifications.save(
        this.notifications.create({
          user: order.user,
          title:
            status === OrderStatus.DELAYED
              ? "Pedido atrasado"
              : status === OrderStatus.PROBLEM
                ? "Atenção ao pedido"
                : "Pedido atualizado",
          message: messages[status]!,
          orderId: order.id,
        }),
      );
    if (
      [OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY].includes(status)
    ) {
      await this.whatsapp
        .status(order.user.phone, order.user.fullName, order.code, status)
        .catch(() => false);
    }
    return this.orders.save(order);
  }
  async payment(
    id: string,
    providerId: string,
    status: PaymentStatus,
    detail?: string,
  ) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException();
    order.paymentProviderId = providerId;
    order.paymentStatus = status;
    order.paymentStatusDetail = detail;
    return this.orders.save(order);
  }
}
