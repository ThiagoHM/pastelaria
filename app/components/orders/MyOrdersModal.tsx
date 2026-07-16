"use client";
import { FormEvent, useState } from "react";
import { api } from "../../api";
const labels: Record<string, string> = {
  PENDING: "Pedido recebido",
  PREPARING: "Em preparação",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  DELAYED: "Pedido atrasado",
  PROBLEM: "Problema no pedido",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const money = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function MyOrdersModal({
  orders,
  close,
  track,
  accessToken,
  reviewedItemIds,
  onReviewed,
}: {
  orders: any[];
  close: () => void;
  track: (o: any) => void;
  accessToken: string;
  reviewedItemIds: string[];
  onReviewed: (itemId:string) => void;
}) {
  const [reviewItem,setReviewItem]=useState<any|null>(null);
  const [rating,setRating]=useState(5);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submitReview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!reviewItem)return;
    setBusy(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      await api("/reviews",{method:"POST",body:JSON.stringify({orderItemId:reviewItem.id,rating,comment:String(form.get("comment")||"")})},accessToken);
      onReviewed(reviewItem.id);setReviewItem(null);
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return (
    <div className="overlay" onClick={close}>
      <aside
        className="drawer orders-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={close}>
          ×
        </button>
        <p className="eyebrow">ACOMPANHAMENTO</p>
        <h2>Meus pedidos</h2>
        {!orders.length ? (
          <div className="empty">
            <span>🥟</span>
            <h3>Você ainda não fez pedidos</h3>
          </div>
        ) : (
          <div className="customer-orders">
            {orders.map((o) => (
              <article
                key={o.id}
                className={
                  ["DELAYED", "PROBLEM"].includes(o.status) ? "order-alert" : ""
                }
              >
                <div>
                  <b>{o.code}</b>
                  <span>{new Date(o.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <p>
                  {o.items
                    .map((i: any) => `${i.quantity}× ${i.name}`)
                    .join(", ")}
                </p>
                <div>
                  <strong className={`customer-status state-${o.status}`}>
                    {labels[o.status]}
                  </strong>
                  <b>{money(o.total)}</b>
                </div>
                {!["COMPLETED", "CANCELLED"].includes(o.status) && (
                  <button className="outline wide" onClick={() => track(o)}>
                    Acompanhar progresso →
                  </button>
                )}
                {o.status === "COMPLETED" && (
                  <div className="mt-3 grid gap-2">
                    {o.items.map((item:any) => reviewedItemIds.includes(item.id) ? (
                      <span key={item.id} className="text-xs text-[#777]">✓ {item.name} avaliado</span>
                    ) : (
                      <button key={item.id} className="outline wide" onClick={() => {setReviewItem(item);setRating(5);setError("")}}>
                        Avaliar {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </aside>
      {reviewItem && <div className="overlay items-center justify-center p-4" onClick={()=>setReviewItem(null)}><form className="modal" onSubmit={submitReview} onClick={event=>event.stopPropagation()}><button type="button" className="close" onClick={()=>setReviewItem(null)}>×</button><p className="eyebrow">SUA OPINIÃO</p><h2>Avaliar {reviewItem.name}</h2>{error&&<p className="form-error">{error}</p>}<div className="my-5 flex justify-center gap-2">{[1,2,3,4,5].map(star=><button aria-label={`${star} estrelas`} type="button" key={star} onClick={()=>setRating(star)} className={`border-0 bg-transparent text-4xl ${star<=rating?"text-[#e9a928]":"text-[#ccc]"}`}>★</button>)}</div><label>Comentário opcional<textarea name="comment" maxLength={500} placeholder="Conte o que achou do produto" /></label><button className="primary wide" disabled={busy}>{busy?"Enviando...":`Enviar avaliação de ${rating} estrela${rating>1?"s":""}`}</button></form></div>}
    </div>
  );
}
