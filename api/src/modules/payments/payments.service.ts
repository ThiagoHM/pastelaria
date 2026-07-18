import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Type } from "class-transformer";
import { IsObject, ValidateNested } from "class-validator";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { PaymentStatus } from "../../database/entities";
import { CreateOrderDto, OrdersService } from "../orders/orders.service";

export class ProcessPaymentDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CreateOrderDto)
  order: CreateOrderDto;
  @IsObject()
  payment: {
    token?: string;
    issuer_id?: string | number;
    payment_method_id: string;
    transaction_amount?: number;
    installments?: number;
    payer?: {
      email?: string;
      identification?: { type: string; number: string };
    };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: Payment;
  private readonly accessToken: string;
  constructor(
    private config: ConfigService,
    private orders: OrdersService,
  ) {
    this.accessToken = this.config.getOrThrow("MERCADO_PAGO_ACCESS_TOKEN");
    this.client = new Payment(
      new MercadoPagoConfig({
        accessToken: this.accessToken,
      }),
    );
  }
  private payerEmail(userEmail?: string) {
    if (!this.accessToken.startsWith("TEST-")) return userEmail;
    const configured = this.config.get<string>("MERCADO_PAGO_TEST_PAYER_EMAIL");
    return configured && !/@testuser\.com$/i.test(configured)
      ? configured
      : "comprador.recanto.qa@gmail.com";
  }
  private localStatus(status?: string) {
    return status === "approved"
      ? PaymentStatus.APPROVED
      : status === "rejected" || status === "cancelled"
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;
  }
  private webhookUrl() {
    const publicUrl = this.config.get<string>("API_PUBLIC_URL")?.replace(/\/$/, "");
    return publicUrl && !/localhost|127\.0\.0\.1/.test(publicUrl)
      ? `${publicUrl}/api/payments/webhook`
      : undefined;
  }
  private errorMessage(error: any) {
    const response = error?.response?.data;
    const cause = response?.cause?.[0];
    return (
      cause?.description ||
      cause?.code ||
      response?.message ||
      error?.message ||
      "O Mercado Pago não conseguiu processar o pagamento"
    );
  }
  async process(user: any, dto: ProcessPaymentDto) {
    const order = await this.orders.create(user.sub, dto.order);
    try {
      const payment = await this.client.create({
        body: {
          transaction_amount: Number(order.total),
          token: dto.payment.token,
          description: `Pedido ${order.code} - Pastelaria Recanto`,
          installments: Number(dto.payment.installments || 1),
          payment_method_id: dto.payment.payment_method_id,
          notification_url: this.webhookUrl(),
          issuer_id: dto.payment.issuer_id
            ? Number(dto.payment.issuer_id)
            : undefined,
          external_reference: order.id,
          payer: {
            email: this.payerEmail(dto.payment.payer?.email || user.email),
            identification: dto.payment.payer?.identification,
          },
        },
        requestOptions: { idempotencyKey: order.id },
      });
      const saved = await this.orders.payment(
        order.id,
        String(payment.id),
        this.localStatus(payment.status),
        payment.status_detail,
      );
      return {
        order: saved,
        payment: {
          id: payment.id,
          status: payment.status,
          statusDetail: payment.status_detail,
          qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64:
            payment.point_of_interaction?.transaction_data?.qr_code_base64,
          ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url,
        },
      };
    } catch (error: any) {
      const message = this.errorMessage(error);
      this.logger.error(
        `Falha no pagamento do pedido ${order.code}: ${message}`,
      );
      await this.orders.payment(
        order.id,
        "",
        PaymentStatus.FAILED,
        message,
      );
      throw new BadRequestException(message);
    }
  }
  async refresh(id: string) {
    const payment = await this.client.get({ id });
    if (payment.external_reference)
      await this.orders.payment(
        payment.external_reference,
        String(payment.id),
        this.localStatus(payment.status),
        payment.status_detail,
      );
    return { ok: true };
  }
}
