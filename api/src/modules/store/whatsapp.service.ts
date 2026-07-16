import { Injectable } from "@nestjs/common";
@Injectable()
export class WhatsAppService {
  async status(phone: string, name: string, code: string, status: string) {
    const token = process.env.WHATSAPP_TOKEN,
      phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) return false;
    const text =
      status === "PREPARING"
        ? `Olá, ${name}! Seu pedido ${code} já está em preparação na Pastelaria Recanto. 🥟`
        : status === "OUT_FOR_DELIVERY"
          ? `Olá, ${name}! Seu pedido ${code} saiu para entrega. 🛵`
          : "";
    if (!text) return false;
    const raw = phone.replace(/\D/g, "").replace(/^0+/, "");
    const to = raw.startsWith("55") ? raw : `55${raw}`;
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      },
    );
    return response.ok;
  }
}
