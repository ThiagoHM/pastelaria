import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsObject } from "class-validator";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { PaymentStatus } from "../../database/entities";
import { CreateOrderDto, OrdersService } from "../orders/orders.service";

export class ProcessPaymentDto {
  @IsObject()
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
  private client: Payment;
  constructor(
    private config: ConfigService,
    private orders: OrdersService,
  ) {
    this.client = new Payment(
      new MercadoPagoConfig({
        accessToken: this.config.getOrThrow("MERCADO_PAGO_ACCESS_TOKEN"),
      }),
    );
  }
  private localStatus(status?: string) {
    return status === "approved"
      ? PaymentStatus.APPROVED
      : status === "rejected" || status === "cancelled"
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;
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
          issuer_id: dto.payment.issuer_id
            ? Number(dto.payment.issuer_id)
            : undefined,
          external_reference: order.id,
          payer: {
            email: dto.payment.payer?.email || user.email,
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
      await this.orders.payment(
        order.id,
        "",
        PaymentStatus.FAILED,
        "integration_error",
      );
      throw new BadRequestException(
        error?.message || "O Mercado Pago não conseguiu processar o pagamento",
      );
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
