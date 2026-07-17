"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, API_URL, Session } from "../../api";

const labels: Record<string, string> = {
  PENDING: "Novo",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  DELAYED: "Atrasado",
  PROBLEM: "Com problema",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const category: Record<string, string> = {
  PASTEL: "Pastel",
  DRINK: "Bebida",
  DESSERT: "Doce",
  COMBO: "Combo",
};
const options = Object.keys(labels),
  money = (v: number) =>
    Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Editor = { kind: "product" | "ingredient"; item?: any } | null;

export function AdminDashboard({
  session,
  orders,
  products,
  ingredients,
  reviews,
  back,
  refresh,
  show,
}: {
  session: Session;
  orders: any[];
  products: any[];
  ingredients: any[];
  reviews: any[];
  back: () => void;
  refresh: () => void | Promise<void>;
  show: (s: string) => void;
}) {
  const [tab, setTab] = useState("Pedidos"),
    [queue, setQueue] = useState<"open" | "done">("open"),
    [editor, setEditor] = useState<Editor>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState<string | null>(null),
    [store,setStore]=useState({isOpen:true,deliveryFee:5,message:"Pastelaria aberta"}),
    [deliveryFeeDraft,setDeliveryFeeDraft]=useState("5"),
    [detail,setDetail]=useState<any|null>(null);
  useEffect(()=>{api<any>("/store/settings").then(value=>{setStore(value);setDeliveryFeeDraft(String(value.deliveryFee))})},[]);
  const paidOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === "APPROVED"),
    [orders],
  );
  const visible = useMemo(
    () =>
      paidOrders.filter((o) =>
        queue === "done"
          ? ["COMPLETED", "CANCELLED"].includes(o.status)
          : !["COMPLETED", "CANCELLED"].includes(o.status),
      ),
    [paidOrders, queue],
  );
  const revenue = paidOrders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + Number(o.total), 0);
  async function saveStatus(order: any) {
    const status = drafts[order.id] || order.status;
    if (status === order.status) return show("Selecione um novo status");
    setSaving(order.id);
    try {
      await api(
        `/admin/orders/${order.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        session.accessToken,
      );
      show("Status salvo e cliente notificado");
      await refresh();
    } catch (e) {
      show((e as Error).message);
    } finally {
      setSaving(null);
    }
  }
  async function uploadImage(file: File) {
    const data = new FormData();
    data.append("image", file);
    const response = await fetch(`${API_URL}/admin/uploads/product-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: data,
    });
    if (!response.ok) throw new Error("Não foi possível enviar a imagem");
    return (await response.json()).imageUrl as string;
  }
  async function toggleStore(){try{const next={isOpen:!store.isOpen,deliveryFee:Number(store.deliveryFee),message:!store.isOpen?"Pastelaria aberta e recebendo pedidos":"Pastelaria fechada no momento"};setStore(await api<any>("/admin/store/settings",{method:"PATCH",body:JSON.stringify(next)},session.accessToken));show(next.isOpen?"Estabelecimento aberto":"Estabelecimento fechado")}catch(e){show((e as Error).message)}}
  async function saveDeliveryFee(){const fee=Number(deliveryFeeDraft);if(!Number.isFinite(fee)||fee<0)return show("Informe uma taxa de entrega válida");setSaving("delivery");try{const updated=await api<any>("/admin/store/settings",{method:"PATCH",body:JSON.stringify({isOpen:store.isOpen,deliveryFee:fee,message:store.message})},session.accessToken);setStore(updated);setDeliveryFeeDraft(String(updated.deliveryFee));show("Taxa de entrega atualizada")}catch(e){show((e as Error).message)}finally{setSaving(null)}}
  async function saveEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    setSaving("editor");
    const form = new FormData(e.currentTarget);
    try {
      if (editor.kind === "product") {
        const file = form.get("image") as File;
        let imageUrl = editor.item?.imageUrl || "";
        if (file?.size) imageUrl = await uploadImage(file);
        const body = {
          name: String(form.get("name")),
          description: String(form.get("description")),
          category: String(form.get("category")),
          price: Number(form.get("price")),
          active: form.get("active") === "on",
          imageUrl,
        };
        await api(
          `/admin/catalog/products${editor.item ? `/${editor.item.id}` : ""}`,
          {
            method: editor.item ? "PATCH" : "POST",
            body: JSON.stringify(body),
          },
          session.accessToken,
        );
      } else {
        const body = {
          name: String(form.get("name")),
          additionalPrice: Number(form.get("additionalPrice")),
          type: String(form.get("type")),
          active: form.get("active") === "on",
        };
        await api(
          `/admin/catalog/ingredients${editor.item ? `/${editor.item.id}` : ""}`,
          {
            method: editor.item ? "PATCH" : "POST",
            body: JSON.stringify(body),
          },
          session.accessToken,
        );
      }
      setEditor(null);
      await refresh();
      show(editor.item ? "Cadastro atualizado" : "Cadastro criado com sucesso");
    } catch (e) {
      show((e as Error).message);
    } finally {
      setSaving(null);
    }
  }
  return (
    <main className="admin">
      <aside className="side">
        <div className="brand">
          <img src="/logo-recanto.png" alt="Pastelaria Recanto" />
          <div>
            <span>PASTELARIA</span>
            <strong>RECANTO</strong>
          </div>
        </div>
        <nav>
          {["Pedidos", "Produtos", "Ingredientes", "Avaliações"].map((x) => (
            <button
              key={x}
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={back}>↗ Ver loja</button>
          <div className="admin-user">
            <span>PR</span>
            <div>
              <b>{session.user.fullName}</b>
              <small>Administrador</small>
            </div>
          </div>
        </div>
      </aside>
      <section className="admin-main">
        <header>
          <div>
            <p>PASTELARIA RECANTO</p>
            <h1>{tab}</h1>
          </div>
          <button className={`store-toggle ${store.isOpen?"is-open":"is-closed"}`} onClick={toggleStore}>{store.isOpen?"● Aberto":"● Fechado"}</button>
          {tab === "Produtos" && (
            <button
              className="new"
              onClick={() => setEditor({ kind: "product" })}
            >
              ＋ Novo produto
            </button>
          )}
          {tab === "Ingredientes" && (
            <button
              className="new"
              onClick={() => setEditor({ kind: "ingredient" })}
            >
              ＋ Novo ingrediente
            </button>
          )}
        </header>
        <div className="stats">
          <div>
            <span>Em andamento</span>
            <b>
              {
                paidOrders.filter(
                  (o) => !["COMPLETED", "CANCELLED"].includes(o.status),
                ).length
              }
            </b>
          </div>
          <div>
            <span>Atenção</span>
            <b>
              {
                paidOrders.filter((o) => ["DELAYED", "PROBLEM"].includes(o.status))
                  .length
              }
            </b>
          </div>
          <div>
            <span>Concluídos</span>
            <b>{paidOrders.filter((o) => o.status === "COMPLETED").length}</b>
          </div>
          <div>
            <span>Faturamento concluído</span>
            <b>{money(revenue)}</b>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap items-end gap-3 border border-recanto-line bg-white p-4">
          <label className="m-0 min-w-52 text-xs font-bold">Taxa de entrega (R$)<input className="mt-2 block w-full border border-recanto-line p-3" type="number" min="0" step="0.01" value={deliveryFeeDraft} onChange={event=>setDeliveryFeeDraft(event.target.value)}/></label>
          <button className="new" disabled={saving==="delivery"} onClick={saveDeliveryFee}>{saving==="delivery"?"Salvando...":"Salvar taxa de entrega"}</button>
          <small className="pb-3 text-[#777]">O novo valor será exibido imediatamente no checkout.</small>
        </div>
        {tab === "Pedidos" ? (
          <>
            <div className="queue-tabs">
              <button
                className={queue === "open" ? "active" : ""}
                onClick={() => setQueue("open")}
              >
                Em andamento{" "}
                <span>
                  {
                    paidOrders.filter(
                      (o) => !["COMPLETED", "CANCELLED"].includes(o.status),
                    ).length
                  }
                </span>
              </button>
              <button
                className={queue === "done" ? "active" : ""}
                onClick={() => setQueue("done")}
              >
                Concluídos{" "}
                <span>
                  {
                    paidOrders.filter((o) =>
                      ["COMPLETED", "CANCELLED"].includes(o.status),
                    ).length
                  }
                </span>
              </button>
            </div>
            <div className="order-table">
              <div className="tr th">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Itens</span>
                <span>Total</span>
                <span>Status</span>
                <span>Salvar</span>
              </div>
              {visible.map((o) => (
                <div
                  className={`tr ${["DELAYED", "PROBLEM"].includes(o.status) ? "attention-row" : ""}`}
                  key={o.id}
                >
                  <b>
                    {o.code}
                    <button className="order-info" title="Ver detalhes do pedido" onClick={()=>setDetail(o)}>!</button>
                    <small>
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </b>
                  <span>
                    {o.user.fullName}
                    <small>
                      {o.fulfillmentType === "DELIVERY"
                        ? "Entrega"
                        : "Retirada"}
                    </small>
                  </span>
                  <span>
                    {o.items
                      .map((i: any) => `${i.quantity}× ${i.name}${i.ingredients?.length ? ` (${i.ingredients.map((ingredient: any) => ingredient.name).join(", ")})` : ""}`)
                      .join(", ")}
                    <small className="note-text">
                      {o.observation || "Sem observação"}
                    </small>
                  </span>
                  <b>
                    {money(o.total)}
                    <small className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-green-700">
                      &#10003; Pagamento concluído
                    </small>
                  </b>
                  <select
                    className={`status-select state-${drafts[o.id] || o.status}`}
                    value={drafts[o.id] || o.status}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [o.id]: e.target.value }))
                    }
                  >
                    {options.map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="confirm-status"
                    disabled={
                      saving === o.id || (drafts[o.id] || o.status) === o.status
                    }
                    onClick={() => saveStatus(o)}
                  >
                    {saving === o.id ? "Salvando..." : "Confirmar"}
                  </button>
                </div>
              ))}
              {!visible.length && (
                <div className="queue-empty">Nenhum pedido nesta fila.</div>
              )}
            </div>
          </>
        ) : tab === "Produtos" ? (
          <div className="manage-grid">
            {products.map((p) => (
              <article key={p.id} className={!p.active ? "inactive" : ""}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} />
                ) : (
                  <div className="image-placeholder">
                    {p.category === "DRINK"
                      ? "🥤"
                      : p.category === "DESSERT"
                        ? "🍫"
                        : "🥟"}
                  </div>
                )}
                <div>
                  <small>
                    {category[p.category]} · {p.active ? "Ativo" : "Inativo"}
                  </small>
                  <h3>{p.name}</h3>
                  <strong>{money(p.price)}</strong>
                  <button
                    onClick={() => setEditor({ kind: "product", item: p })}
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : tab === "Ingredientes" ? (
          <div className="ingredient-list">
            {ingredients.map((i) => (
              <div key={i.id} className={!i.active ? "inactive" : ""}>
                <div>
                  <b>{i.name}</b>
                  <small>
                    {i.active
                      ? i.type === "SAUCE" ? "Molho disponível no checkout" : "Disponível para personalização"
                      : "Indisponível"}
                  </small>
                </div>
                <strong>+ {money(i.additionalPrice)}</strong>
                <button
                  onClick={() => setEditor({ kind: "ingredient", item: i })}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {!reviews.length && <div className="queue-empty">Nenhuma avaliação recebida ainda.</div>}
            {reviews.map((review) => (
              <article key={review.id} className="border border-recanto-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <small className="text-[#777]">{new Date(review.createdAt).toLocaleString("pt-BR")}</small>
                    <h3 className="my-1 font-serif text-xl">{review.productName}</h3>
                    <span className="text-xs text-[#777]">Avaliado por {review.userName}</span>
                  </div>
                  <strong className="text-xl tracking-1 text-[#e9a928]">{"★".repeat(review.rating)}<span className="text-[#ddd]">{"★".repeat(5-review.rating)}</span></strong>
                </div>
                <p className="mb-0 mt-4 text-sm leading-6 text-[#5f584d]">{review.comment || "Sem comentário."}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      {detail&&<div className="overlay" onClick={()=>setDetail(null)}><div className="modal order-detail max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setDetail(null)}>×</button><p className="eyebrow">PEDIDO {detail.code}</p><h2>Dados do cliente</h2><dl><dt>Nome</dt><dd>{detail.user.fullName}</dd><dt>Telefone</dt><dd>{detail.user.phone||"Não informado"}</dd><dt>Endereço</dt><dd>{detail.fulfillmentType==="DELIVERY"?`${detail.deliveryAddress?.street}, ${detail.deliveryAddress?.number} · CEP ${detail.deliveryAddress?.cep}`:"Retirada no estabelecimento"}</dd></dl><h3>Itens do pedido</h3><ul>{detail.items.map((i:any)=><li className="block" key={i.id}><span className="flex justify-between">{i.quantity}× {i.name} <b>{money(i.total)}</b></span>{i.ingredients?.length>0&&<small className="mt-1 block text-[#777]">Ingredientes: {i.ingredients.map((ingredient:any)=>ingredient.name).join(", ")}</small>}</li>)}</ul><p><b>Molhos:</b> {detail.sauces?.length ? detail.sauces.map((s:any)=>s.name).join(", ") : "Nenhum"}</p>{detail.observation&&<p><b>Observação:</b> {detail.observation}</p>}<a className="whatsapp-contact" target="_blank" rel="noreferrer" href={`https://wa.me/${String(detail.user.phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(`Olá, ${detail.user.fullName}. Estamos entrando em contato sobre o pedido ${detail.code} da Pastelaria Recanto.`)}`}>Entrar em contato pelo WhatsApp</a></div></div>}
      {editor && (
        <div className="overlay" onClick={() => setEditor(null)}>
          <form
            className="modal editor-modal"
            onSubmit={saveEditor}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="close"
              onClick={() => setEditor(null)}
            >
              ×
            </button>
            <p className="eyebrow">
              {editor.kind === "product" ? "CARDÁPIO" : "PERSONALIZAÇÃO"}
            </p>
            <h2>
              {editor.item ? "Editar" : "Novo"}{" "}
              {editor.kind === "product" ? "produto" : "ingrediente"}
            </h2>
            <label>
              Nome
              <input name="name" defaultValue={editor.item?.name} required />
            </label>
            {editor.kind === "product" ? (
              <>
                <label>
                  Descrição
                  <textarea
                    name="description"
                    defaultValue={editor.item?.description}
                    required
                  />
                </label>
                <div className="form-row">
                  <label>
                    Categoria
                    <select
                      name="category"
                      defaultValue={editor.item?.category || "PASTEL"}
                    >
                      <option value="PASTEL">Pastel</option>
                      <option value="DRINK">Bebida</option>
                      <option value="DESSERT">Doce</option>
                      <option value="COMBO">Combo</option>
                    </select>
                  </label>
                  <label>
                    Preço
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editor.item?.price}
                      required
                    />
                  </label>
                </div>
                <label className="image-upload">
                  Imagem do produto
                  <input
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                  <small>PNG, JPG ou WebP de até 5 MB</small>
                </label>
                {editor.item?.imageUrl && (
                  <img
                    className="image-preview"
                    src={editor.item.imageUrl}
                    alt="Imagem atual"
                  />
                )}
              </>
            ) : (
              <div className="form-row">
                <label>
                  Tipo
                  <select name="type" defaultValue={editor.item?.type || "FILLING"}>
                    <option value="FILLING">Recheio do pastel</option>
                    <option value="SAUCE">Molho</option>
                  </select>
                </label>
                <label>
                  Valor adicional
                  <input
                    name="additionalPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editor.item?.additionalPrice || 0}
                    required
                  />
                </label>
              </div>
            )}
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editor.item?.active ?? true}
              />{" "}
              Disponível no cardápio
            </label>
            <button className="primary wide" disabled={saving === "editor"}>
              {saving === "editor"
                ? "Salvando..."
                : editor.item
                  ? "Salvar alterações"
                  : "Cadastrar"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
