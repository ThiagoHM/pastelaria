"use client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loadSession, saveSession, Session } from "./api";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { MyOrdersModal } from "./components/orders/MyOrdersModal";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
const mercadoPagoTestMode = mercadoPagoPublicKey?.startsWith("TEST-") ?? false;
if (mercadoPagoPublicKey) initMercadoPago(mercadoPagoPublicKey, { locale: "pt-BR" });

const paymentStatusMessage = (status?: string, detail?: string) => {
  if (status === "rejected" && mercadoPagoTestMode)
    return "Pagamento de teste recusado. Para simular uma aprovação, use um cartão de teste do Mercado Pago, informe APRO como nome do titular e CPF 12345678909.";
  if (status === "rejected" && detail === "cc_rejected_other_reason")
    return "Pagamento recusado pela análise de segurança. Tente outro cartão ou entre em contato com o banco emissor.";
  if (status === "rejected")
    return `Pagamento recusado pelo Mercado Pago${detail ? ` (${detail})` : ""}. Confira os dados ou use outro cartão.`;
  if (status === "cancelled") return "Pagamento cancelado. Tente novamente.";
  return "Pagamento em análise. O pedido aparecerá para a pastelaria assim que for aprovado.";
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "PASTEL" | "DRINK" | "DESSERT" | "COMBO";
  imageUrl?: string;
  active?: boolean;
};
type CartItem = Product & {
  qty: number;
  productId?: string;
  ingredientIds?: string[];
};
type Ingredient = {
  id: string;
  name: string;
  additionalPrice: number;
  active: boolean;
  type: "FILLING" | "SAUCE";
};
type ApiOrder = {
  id: string;
  code: string;
  status: string;
  paymentStatus: "PENDING" | "APPROVED" | "FAILED";
  paymentMethod: string;
  paymentStatusDetail?: string;
  fulfillmentType: string;
  total: number;
  observation?: string;
  createdAt: string;
  user: { fullName: string };
  items: { id: string; productId: string; name: string; quantity: number }[];
  sauces?: { id: string; name: string }[];
};
const money = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const categoryLabel = { PASTEL: "Pastéis", DRINK: "Bebidas", DESSERT: "Doces", COMBO: "Combos" };
const statusLabel: Record<string, string> = {
  PENDING: "Novo",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  DELAYED: "Atrasado",
  PROBLEM: "Com problema",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const statusNext: Record<string, string> = {
  PENDING: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "COMPLETED",
  READY_FOR_PICKUP: "COMPLETED",
};
const emoji = (c: string) =>
  c === "DRINK" ? "🥤" : c === "DESSERT" ? "🍫" : "🥟";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [ingredients, setIngredients] = useState<Ingredient[]>([]),
    [orders, setOrders] = useState<ApiOrder[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [mode, setMode] = useState<"store" | "admin">("store"),
    [category, setCategory] = useState("Todos"),
    [search, setSearch] = useState(""),
    [cart, setCart] = useState<CartItem[]>([]),
    [cartOpen, setCartOpen] = useState(false),
    [checkout, setCheckout] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [customPastelOpen, setCustomPastelOpen] = useState(false),
    [authAdmin, setAuthAdmin] = useState(false),
    [toast, setToast] = useState(""),
    [apiOffline, setApiOffline] = useState(false),
    [currentOrder, setCurrentOrder] = useState<ApiOrder | null>(null),
    [myOrders, setMyOrders] = useState<ApiOrder[]>([]),
    [reviewedItemIds, setReviewedItemIds] = useState<string[]>([]),
    [myOrdersOpen, setMyOrdersOpen] = useState(false),
    [store, setStore] = useState({isOpen:true,deliveryFee:5,message:"Pastelaria aberta"}),
    [comboIndex,setComboIndex]=useState(0),
    [useOtherAddress,setUseOtherAddress]=useState(false),
    [otherAddress,setOtherAddress]=useState({cep:"",street:"",number:"",complement:""});
  const [delivery, setDelivery] = useState("Entrega"),
    [payment, setPayment] = useState("Pix"),
    [observation, setObservation] = useState("");
  const [selectedSauceIds, setSelectedSauceIds] = useState<string[]>([]);
  useEffect(() => {
    setSession(loadSession());
    refreshCatalog();
  }, []);
  useEffect(() => {
    if (session?.user.role === "ADMIN" && mode === "admin") refreshAdmin();
  }, [session, mode]);
  useEffect(() => {
    if (session?.user.role !== "ADMIN" || mode !== "admin") return;
    const timer = setInterval(() => void refreshAdmin(), 10000);
    return () => clearInterval(timer);
  }, [session?.accessToken, session?.user.role, mode]);
  useEffect(() => {
    if (!currentOrder || !session) return;
    const timer = setInterval(async () => {
      try {
        setCurrentOrder(
          await api<ApiOrder>(
            `/orders/${currentOrder.id}`,
            {},
            session.accessToken,
          ),
        );
      } catch {}
    }, 8000);
    return () => clearInterval(timer);
  }, [currentOrder?.id, session?.accessToken]);
  useEffect(()=>{const count=products.filter(p=>p.category==="COMBO").length;if(count<2)return;const timer=setInterval(()=>setComboIndex(i=>(i+1)%count),4500);return()=>clearInterval(timer)},[products]);
  async function refreshCatalog() {
    try {
      const [p, i, s] = await Promise.all([
        api<Product[]>("/catalog/products"),
        api<Ingredient[]>("/catalog/ingredients"),
        api<any>("/store/settings"),
      ]);
      setProducts(p.map((x) => ({ ...x, price: Number(x.price) })));
      setIngredients(i);
      setStore(s);
      setApiOffline(false);
    } catch {
      setApiOffline(true);
    }
  }
  async function refreshAdmin() {
    if (!session) return;
    try {
      const [orderData, productData, ingredientData, reviewData] = await Promise.all([
        api<ApiOrder[]>("/admin/orders", {}, session.accessToken),
        api<Product[]>("/admin/catalog/products", {}, session.accessToken),
        api<Ingredient[]>("/admin/catalog/ingredients", {}, session.accessToken),
        api<any[]>("/admin/reviews", {}, session.accessToken),
      ]);
      setOrders(orderData);
      setProducts(productData.map((x) => ({ ...x, price: Number(x.price) })));
      setIngredients(ingredientData);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
    } catch (e) {
      show((e as Error).message);
    }
  }
  function show(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 2600);
  }
  function add(p: Product) {
    if(!store.isOpen && session?.user.role !== "ADMIN"){show("A Pastelaria Recanto está fechada no momento");return}
    setCart((c) =>
      c.some((i) => i.id === p.id)
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { ...p, qty: 1 }],
    );
    show(`${p.name} foi para a sacola`);
  }
  function addCustomPastel(base: Product, selected: Ingredient[]) {
    if (!store.isOpen && session?.user.role !== "ADMIN") {
      show("A Pastelaria Recanto está fechada no momento");
      return;
    }
    const ingredientIds = selected.map((i) => i.id).sort();
    const customId = `custom-${base.id}-${ingredientIds.join("-")}`;
    const price = Number(base.price) + selected.reduce((sum, i) => sum + Number(i.additionalPrice), 0);
    const item: CartItem = {
      ...base,
      id: customId,
      productId: base.id,
      ingredientIds,
      name: "Pastel personalizado",
      description: selected.map((i) => i.name).join(", "),
      price,
      qty: 1,
    };
    setCart((current) =>
      current.some((i) => i.id === customId)
        ? current.map((i) => (i.id === customId ? { ...i, qty: i.qty + 1 } : i))
        : [...current, item],
    );
    setCustomPastelOpen(false);
    show("Pastel personalizado foi para a sacola");
  }
  function qty(id: string, d: number) {
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, qty: i.qty + d } : i))
        .filter((i) => i.qty > 0),
    );
  }
  function goAdmin() {
    if (session?.user.role === "ADMIN") setMode("admin");
    else {
      setAuthAdmin(true);
      setAuthOpen(true);
    }
  }
  async function openMyOrders() {
    if (!session) {
      setAuthAdmin(false);
      setAuthOpen(true);
      return;
    }
    try {
      const [customerOrders, reviews] = await Promise.all([
        api<ApiOrder[]>("/orders/mine", {}, session.accessToken),
        api<{orderItemId:string}[]>("/reviews/mine", {}, session.accessToken),
      ]);
      setMyOrders(customerOrders);
      setReviewedItemIds(reviews.map((review) => review.orderItemId));
      setMyOrdersOpen(true);
    } catch (e) {
      show((e as Error).message);
    }
  }
  function logout() {
    saveSession(null);
    setSession(null);
    setMode("store");
    show("Você saiu da sua conta");
  }
  async function processPayment(paymentData:any) {
    if (!session) {
      setAuthAdmin(false);
      setAuthOpen(true);
      return;
    }
    try {
      const result = await api<{order:ApiOrder;payment:any}>(
        "/payments/process",
        {
          method: "POST",
          body: JSON.stringify({
            order:{
              items: cart.map((i) => ({productId:i.productId??i.id,quantity:i.qty,ingredientIds:i.ingredientIds??[]})),
              fulfillmentType:delivery==="Entrega"?"DELIVERY":"PICKUP",
              paymentMethod:paymentData.payment_method_id==="pix"?"PIX":paymentData.payment_type_id==="debit_card"?"DEBIT_CARD":"CREDIT_CARD",
              observation,sauceIds:selectedSauceIds,
              deliveryAddress:delivery==="Entrega"&&useOtherAddress?otherAddress:undefined,
            },
            payment:paymentData,
          }),
        },
        session.accessToken,
      );
      if(result.payment.status==="approved"){
        setCurrentOrder(result.order);setCartOpen(false);setCart([]);setSelectedSauceIds([]);show("Pagamento aprovado e pedido confirmado!");
      } else if (["rejected", "cancelled"].includes(result.payment.status)) {
        throw new Error(paymentStatusMessage(result.payment.status, result.payment.statusDetail));
      } else {
        show(paymentStatusMessage(result.payment.status, result.payment.statusDetail));
      }
      return result;
    } catch (e) {
      show((e as Error).message);
      throw e;
    }
  }
  async function createInPersonOrder() {
    if (!session || session.user.role !== "ADMIN")
      throw new Error("Apenas o administrador pode criar pedidos presenciais");
    const order = await api<ApiOrder>(
      "/admin/orders/in-person",
      {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId ?? i.id, quantity: i.qty, ingredientIds: i.ingredientIds ?? [] })),
          fulfillmentType: "PICKUP",
          paymentMethod: "IN_PERSON",
          observation,
          sauceIds: selectedSauceIds,
        }),
      },
      session.accessToken,
    );
    setCart([]);
    setSelectedSauceIds([]);
    setObservation("");
    setCheckout(false);
    setCartOpen(false);
    setMode("admin");
    await refreshAdmin();
    show(`Pedido ${order.code} criado como não pago`);
    return order;
  }
  const combos=products.filter(p=>p.category==="COMBO");
  const filtered = products.filter(
    (p) =>
      (category === "Todos" || categoryLabel[p.category] === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const count = cart.reduce((s, i) => s + i.qty, 0),
    subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0),
    sauceTotal = ingredients.filter((ingredient) => selectedSauceIds.includes(ingredient.id)).reduce((sum,ingredient)=>sum+Number(ingredient.additionalPrice),0),
    total = subtotal + sauceTotal + (delivery === "Entrega" && cart.length ? Number(store.deliveryFee) : 0);
  if (mode === "admin")
    return (
      <AdminDashboard
        session={session!}
        orders={orders}
        products={products}
        ingredients={ingredients}
        reviews={reviews}
        back={() => setMode("store")}
        refresh={refreshAdmin}
        show={show}
      />
    );
  if (currentOrder)
    return (
      <Tracking
        order={currentOrder}
        total={Number(currentOrder.total)}
        back={() => setCurrentOrder(null)}
      />
    );
  return (
    <main>
      {toast && <div className="toast">✓ {toast}</div>}
      {apiOffline && (
        <div className="api-banner">
          A loja está temporariamente sem conexão. Inicie a API para carregar o
          cardápio.
        </div>
      )}
      <header className="flex min-h-20 items-center justify-between gap-6 border-b border-[#e6ddcc] bg-[#fffaf0] px-[clamp(1.25rem,6vw,8rem)] py-3 max-lg:flex-wrap">
        <Brand />
        <nav className="flex items-center gap-8 text-sm font-semibold text-[#29251f] max-md:hidden [&_a]:transition-colors [&_a:hover]:text-[#c92b25]">
          <a href="#menu">Cardápio</a>
          <a href="#about">Nossa história</a>
          <a href="#contact">Contato</a>
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-between">
          {session?.user.role === "ADMIN" && (
            <button
              className="rounded-sm border border-[#c92b25] bg-transparent px-4 py-2.5 text-sm font-extrabold text-[#c92b25] transition-colors hover:bg-[#c92b25] hover:text-white"
              onClick={() => setMode("admin")}
            >
              Painel administrativo
            </button>
          )}
          {session && (
            <button className="border-0 bg-transparent px-3 py-2 text-sm font-bold text-[#29251f] hover:text-[#c92b25]" onClick={openMyOrders}>
              Meus pedidos
            </button>
          )}
          <button
            className="border-0 bg-transparent px-3 py-2 text-sm font-bold text-[#29251f] hover:text-[#c92b25] max-sm:px-1 max-sm:text-xs"
            onClick={() =>
              session ? logout() : (setAuthAdmin(false), setAuthOpen(true))
            }
          >
            {session
              ? `${session.user.fullName.split(" ")[0]} · Sair`
              : "Entrar / Cadastrar"}
          </button>
          <button className="flex items-center gap-2 rounded-sm bg-[#c92b25] px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_#8f1d19] transition-transform hover:-translate-y-0.5" onClick={() => setCartOpen(true)}>
            Sacola <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[#fff3d4] px-1 text-xs text-[#9d211c]">{count}</span>
          </button>
        </div>
      </header>
      <div className={`flex items-center justify-center gap-3 px-5 py-2 text-center text-sm ${store.isOpen ? "bg-[#e9f6ea] text-[#24652c]" : "bg-[#f8dfdc] text-[#8c231f]"}`}><strong className="text-xs tracking-[.12em]">{store.isOpen?"● ABERTO AGORA":"● FECHADO"}</strong><span>{store.message}</span></div>
      <section className="grid min-h-[590px] grid-cols-2 overflow-hidden bg-[#f8f2e6] max-lg:grid-cols-1">
        <div className="flex flex-col justify-center px-[clamp(2rem,7vw,8.5rem)] py-20 max-lg:py-16">
          <p className="mb-5 text-xs font-black tracking-[.25em] text-[#c92b25]">FEITO NA HORA, DO NOSSO JEITO</p>
          <h1 className="mb-5 font-serif text-[clamp(3rem,5vw,5.2rem)] font-bold leading-[.96] text-[#29251f]">
            Pastel bom é<br />
            <em className="font-normal text-[#c92b25]">pastel de verdade.</em>
          </h1>
          <p className="mb-6 max-w-lg font-serif text-lg leading-relaxed text-[#51483c]">Venha saborear o melhor pastel da região 😊🤭</p>
          <button
            className="flex w-fit items-center gap-14 rounded-sm bg-[#c92b25] px-6 py-4 font-extrabold text-white shadow-[0_4px_0_#8f1d19] transition-transform hover:-translate-y-0.5"
            onClick={() =>
              document
                .getElementById("menu")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Ver o cardápio <span>↓</span>
          </button>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-bold text-[#493f32]">
            <span>★ 4,9 no Google</span>
            <span>•</span>
            <span>Entrega em até 45 min</span>
          </div>
        </div>
        <div className="hero-art min-h-[590px] max-lg:min-h-[520px]">
          {combos.length ? <div className="hero-carousel" key={combos[comboIndex%combos.length].id}>{combos[comboIndex%combos.length].imageUrl?<img src={combos[comboIndex%combos.length].imageUrl} alt={combos[comboIndex%combos.length].name}/>:<div className="combo-fallback">🥟 + 🥤</div>}<div className="hero-combo-caption"><small>COMBO ESPECIAL</small><h2>{combos[comboIndex%combos.length].name}</h2><p>{combos[comboIndex%combos.length].description}</p><strong>{money(combos[comboIndex%combos.length].price)}</strong><button disabled={!store.isOpen} onClick={()=>add(combos[comboIndex%combos.length])}>Adicionar à sacola</button></div><div className="combo-dots">{combos.map((_,i)=><button key={i} aria-label={`Mostrar combo ${i+1}`} className={i===comboIndex%combos.length?"active":""} onClick={()=>setComboIndex(i)}/>)}</div></div>:<div className="hero-empty-combo"><span>🥟</span><p>Não temos nenhum combo disponível no momento.</p></div>}
        </div>
      </section>
      <section className="menu-section" id="menu">
        <div className="section-top">
          <div>
            <p className="eyebrow">ESCOLHA O SEU FAVORITO</p>
            <h2>Nosso cardápio</h2>
          </div>
          <div className="search">
            <span>⌕</span>
            <input
              aria-label="Buscar no cardápio"
              placeholder="Buscar no cardápio"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="filters">
          {["Todos", "Pastéis", "Bebidas", "Doces"].map((c) => (
            <button
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
              key={c}
            >
              {c}
            </button>
          ))}
          <button
            className="custom"
            onClick={() => setCustomPastelOpen(true)}
          >
            ＋ Monte seu pastel
          </button>
        </div>
        <div className="grid">
          {filtered.map((p, n) => (
            <article className="product" key={p.id}>
              <div className={`product-img tone-${n % 4}`}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} />
                ) : (
                  <span>{emoji(p.category)}</span>
                )}
              </div>
              <div className="product-info">
                <small>{categoryLabel[p.category]}</small>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div>
                  <strong>{money(p.price)}</strong>
                  <button
                    aria-label={`Adicionar ${p.name}`}
                    onClick={() => add(p)}
                  >
                    ＋
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!apiOffline && !products.length && (
          <p className="empty-products">
            Nenhum produto disponível no momento.
          </p>
        )}
      </section>
      <section className="about" id="about">
        <div>
          <p className="eyebrow">TRADIÇÃO E SABOR</p>
          <h2>
            Receita de família.
            <br />
            Sabor que atravessa gerações.
          </h2>
        </div>
        <p>
          Todo pastel é aberto, recheado e frito na hora. A gente acredita que
          comida simples, feita com capricho, é a que deixa as melhores
          lembranças.
        </p>
      </section>
      <footer className="flex items-center justify-between gap-8 bg-[#29251f] px-[clamp(1.5rem,7vw,8rem)] py-10 text-[#fffaf0] max-md:flex-col max-md:items-start" id="contact">
        <Brand />
        <p className="text-sm leading-7 text-[#ded4c4]">
          Atendimento de terça a sábado, a partir das 18h
          <br />
          Praça Nove de Julho · Centro · Fartura/SP · CEP 18870-000
        </p>
        <a className="border-b border-[#df4534] pb-1 text-sm font-extrabold text-white transition-colors hover:text-[#f2b83f]" href="https://www.instagram.com/pastelariadofio?igsh=MXRoYXFxcmw2YWt6eA==" target="_blank" rel="noreferrer">Instagram ↗</a>
      </footer>
      {cartOpen && (
        <div className="overlay" onClick={() => setCartOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setCartOpen(false)}>
              ×
            </button>
            {!checkout ? (
              <>
                <p className="eyebrow">SEU PEDIDO</p>
                <h2>
                  Minha sacola <span>{count} itens</span>
                </h2>
                {!cart.length ? (
                  <div className="empty">
                    <span>🥟</span>
                    <h3>Sua sacola está vazia</h3>
                  </div>
                ) : (
                  <>
                    <div className="cart-list">
                      {cart.map((i) => (
                        <div className="cart-item" key={i.id}>
                          <span className="mini">{emoji(i.category)}</span>
                          <div>
                            <b>{i.name}</b>
                            <small>{money(i.price)}</small>
                          </div>
                          <div className="counter">
                            <button onClick={() => qty(i.id, -1)}>−</button>
                            <span>{i.qty}</span>
                            <button onClick={() => qty(i.id, 1)}>＋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="totals">
                      <p>
                        <span>Subtotal</span>
                        <b>{money(subtotal)}</b>
                      </p>
                      <p className="grand">
                        <span>Total com entrega</span>
                        <b>{money(subtotal + Number(store.deliveryFee))}</b>
                      </p>
                    </div>
                    <button
                      className="primary wide"
                      onClick={() => setCheckout(true)}
                    >
                      Continuar para pagamento →
                    </button>
                  </>
                )}
              </>
            ) : (
              <Checkout
                delivery={delivery}
                setDelivery={setDelivery}
                payment={payment}
                setPayment={setPayment}
                observation={observation}
                setObservation={setObservation}
                sauces={ingredients.filter((i) => i.active && i.type === "SAUCE")}
                selectedSauceIds={selectedSauceIds}
                setSelectedSauceIds={setSelectedSauceIds}
                total={total}
                session={session}
                deliveryFee={Number(store.deliveryFee)}
                useOtherAddress={useOtherAddress}
                setUseOtherAddress={setUseOtherAddress}
                otherAddress={otherAddress}
                setOtherAddress={setOtherAddress}
                back={() => setCheckout(false)}
                pay={processPayment}
                createInPerson={createInPersonOrder}
              />
            )}
          </aside>
        </div>
      )}
      {customPastelOpen && (
        <CustomPastelModal
          products={products.filter((p) => p.category === "PASTEL" && p.active !== false)}
              ingredients={ingredients.filter((i) => i.active && i.type !== "SAUCE")}
          close={() => setCustomPastelOpen(false)}
          confirm={addCustomPastel}
        />
      )}
      {authOpen && (
        <AuthModal
          admin={authAdmin}
          close={() => setAuthOpen(false)}
          success={(s) => {
            saveSession(s);
            setSession(s);
            setAuthOpen(false);
            if (s.user.role === "ADMIN") setMode("admin");
            show("Bem-vindo à Pastelaria Recanto!");
          }}
        />
      )}
      {myOrdersOpen && (
        <MyOrdersModal
          orders={myOrders}
          accessToken={session!.accessToken}
          reviewedItemIds={reviewedItemIds}
          onReviewed={(itemId) => setReviewedItemIds((ids) => [...ids, itemId])}
          close={() => setMyOrdersOpen(false)}
          track={(o) => {
            setMyOrdersOpen(false);
            setCurrentOrder(o);
          }}
        />
      )}
    </main>
  );
}

function CustomPastelModal({
  products,
  ingredients,
  close,
  confirm,
}: {
  products: Product[];
  ingredients: Ingredient[];
  close: () => void;
  confirm: (base: Product, selected: Ingredient[]) => void;
}) {
  const [baseId, setBaseId] = useState(products[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const base = products.find((p) => p.id === baseId);
  const selected = ingredients.filter((i) => selectedIds.includes(i.id));
  const total = Number(base?.price ?? 0) + selected.reduce((sum, i) => sum + Number(i.additionalPrice), 0);

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="overlay items-center justify-center p-4" onClick={close}>
      <div className="modal max-h-[90vh] overflow-auto" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={close}>×</button>
        <p className="eyebrow">MONTE DO SEU JEITO</p>
        <h2>Meu pastel</h2>
        {!products.length ? (
          <p className="form-error">Nenhuma opção de pastel está disponível no momento.</p>
        ) : (
          <>
            <label>
              Escolha a base
              <select value={baseId} onChange={(event) => setBaseId(event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {money(product.price)}
                  </option>
                ))}
              </select>
            </label>
            <div className="my-6">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#777]">Escolha os ingredientes</p>
              <div className="grid max-h-72 grid-cols-2 gap-2 overflow-auto max-sm:grid-cols-1">
                {ingredients.map((ingredient) => {
                  const checked = selectedIds.includes(ingredient.id);
                  return (
                    <button
                      type="button"
                      key={ingredient.id}
                      onClick={() => toggle(ingredient.id)}
                      className={`flex items-center justify-between gap-3 border p-3 text-left text-sm ${checked ? "border-recanto-red bg-[#fff2e8] text-recanto-red" : "border-recanto-line bg-white"}`}
                    >
                      <span><b className="block">{ingredient.name}</b><small className="text-[#777]">+ {money(ingredient.additionalPrice)}</small></span>
                      <span className={`grid h-5 w-5 place-items-center rounded-full border text-xs ${checked ? "border-recanto-red bg-recanto-red text-white" : "border-[#bbb]"}`}>{checked ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mb-5 flex items-center justify-between border-t border-recanto-line pt-4">
              <span><small className="block text-[#777]">{selected.length} ingrediente(s)</small><b>Total</b></span>
              <strong className="font-serif text-2xl text-recanto-red">{money(total)}</strong>
            </div>
            <button className="primary wide" disabled={!base || !selected.length} onClick={() => base && confirm(base, selected)}>
              Adicionar à sacola
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img className="h-14 w-14 rounded-full object-cover" src="/logo-recanto.png" alt="Pastelaria Recanto" />
      <div className="flex flex-col leading-none">
        <span className="text-[.65rem] font-black tracking-[.22em] text-[#df4534]">PASTELARIA</span>
        <strong className="mt-1 font-serif text-xl tracking-[.08em]">RECANTO</strong>
      </div>
    </div>
  );
}
function AuthModal({
  admin,
  close,
  success,
}: {
  admin: boolean;
  close: () => void;
  success: (s: Session) => void;
}) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const s = await api<Session>(
        register ? "/auth/register" : "/auth/login",
        { method: "POST", body: JSON.stringify(data) },
      );
      if (admin && s.user.role !== "ADMIN")
        throw new Error("Esta conta não possui acesso administrativo");
      success(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay auth-overlay" onClick={close}>
      <form
        className="modal auth-modal max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain max-sm:w-[calc(100%-1rem)] max-sm:p-5 max-sm:[&_label]:my-2"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          ×
        </button>
        <p className="eyebrow">{admin ? "ÁREA ADMINISTRATIVA" : "SUA CONTA"}</p>
        <h2>{register ? "Criar conta" : "Entrar"}</h2>
        {error && <p className="form-error">{error}</p>}{" "}
        {register && (
          <label>
            Nome completo
            <input name="fullName" required />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" required />
        </label>
        <label>
          Senha
          <input name="password" type="password" minLength={6} required />
        </label>
        {register && (
          <>
            <label>Telefone / WhatsApp<input name="phone" type="tel" placeholder="(11) 99999-9999" required /></label>
            <div className="form-row">
              <label>
                CEP
                <input name="cep" required />
              </label>
              <label>
                Número
                <input name="number" required />
              </label>
            </div>
            <label>
              Rua
              <input name="street" required />
            </label>
            <label>
              Complemento
              <input name="complement" />
            </label>
          </>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "Aguarde..." : register ? "Cadastrar e entrar" : "Entrar"}
        </button>
        {!admin && (
          <button
            type="button"
            className="switch-auth"
            onClick={() => setRegister(!register)}
          >
            {register ? "Já tenho uma conta" : "Ainda não tenho conta"}
          </button>
        )}
      </form>
    </div>
  );
}
function Checkout({
  delivery,
  setDelivery,
  payment,
  setPayment,
  observation,
  setObservation,
  sauces,
  selectedSauceIds,
  setSelectedSauceIds,
  total,
  session,
  deliveryFee,
  useOtherAddress,
  setUseOtherAddress,
  otherAddress,
  setOtherAddress,
  back,
  pay,
  createInPerson,
}: {
  delivery: string;
  setDelivery: (v: string) => void;
  payment: string;
  setPayment: (v: string) => void;
  observation: string;
  setObservation: (v: string) => void;
  sauces: Ingredient[];
  selectedSauceIds: string[];
  setSelectedSauceIds: (v: string[]) => void;
  total: number;
  session: Session|null;
  deliveryFee:number;
  useOtherAddress:boolean;
  setUseOtherAddress:(v:boolean)=>void;
  otherAddress:{cep:string;street:string;number:string;complement:string};
  setOtherAddress:(v:{cep:string;street:string;number:string;complement:string})=>void;
  back: () => void;
  pay: (data:any) => Promise<any>;
  createInPerson: () => Promise<any>;
}) {
  const [paymentResult,setPaymentResult]=useState<any|null>(null);
  const [paymentError,setPaymentError]=useState("");
  const [creatingInPerson,setCreatingInPerson]=useState(false);
  const payRef=useRef(pay);
  useEffect(()=>{payRef.current=pay},[pay]);
  const paymentInitialization=useMemo(
    ()=>({amount:total,payer:{email:mercadoPagoTestMode ? "comprador.recanto.qa@gmail.com" : session?.user.email}}),
    [total,session?.user.email],
  );
  const paymentCustomization=useMemo(
    ()=>({paymentMethods:{bankTransfer:["pix"],creditCard:"all" as const,debitCard:"all" as const,maxInstallments:6}}),
    [],
  );
  const handlePaymentSubmit=useCallback(async(data:any)=>{
    setPaymentError("");
    try{
      const paymentData={...data.formData,payment_type_id:data.paymentType};
      const result=await payRef.current(paymentData);
      setPaymentResult(result);
      return result;
    }catch(error){
      setPaymentError((error as Error).message);
      throw error;
    }
  },[]);
  const handlePaymentError=useCallback((error:any)=>{
    setPaymentError(error.message||"Não foi possível carregar o pagamento");
  },[]);
  if(paymentResult && paymentResult.payment?.status !== "approved") {
    const isPix = Boolean(paymentResult.payment?.qrCode);
    return isPix
      ? <PixPending result={paymentResult} />
      : <CardPending result={paymentResult} back={() => setPaymentResult(null)} />;
  }
  return (
    <>
      <button className="back" onClick={back}>
        ← Voltar
      </button>
      <p className="eyebrow">FINALIZAR PEDIDO</p>
      <h2>Entrega e pagamento</h2>
      <h4>Como você quer receber?</h4>
      <div className="choice-row">
        {["Entrega", "Retirada"].map((v) => (
          <button
            className={delivery === v ? "selected" : ""}
            onClick={() => setDelivery(v)}
            key={v}
          >
            <span>{v === "Entrega" ? "🛵" : "🏪"}</span>
            <b>{v}</b>
            <small>{v === "Entrega" ? "35–45 min" : "20–30 min"}</small>
          </button>
        ))}
      </div>
      {delivery === "Entrega" && <div className="delivery-address"><h4>Endereço de entrega</h4><label className="address-option"><input type="radio" checked={!useOtherAddress} onChange={()=>setUseOtherAddress(false)}/><span><b>Usar endereço cadastrado</b><small>{session?.user.street}, {session?.user.number} · CEP {session?.user.cep}</small></span></label><label className="address-option"><input type="radio" checked={useOtherAddress} onChange={()=>setUseOtherAddress(true)}/><span><b>Entregar em outro endereço</b><small>Informe o endereço deste pedido</small></span></label>{useOtherAddress&&<div className="other-address"><input placeholder="CEP" value={otherAddress.cep} onChange={e=>setOtherAddress({...otherAddress,cep:e.target.value})}/><input placeholder="Rua" value={otherAddress.street} onChange={e=>setOtherAddress({...otherAddress,street:e.target.value})}/><input placeholder="Número" value={otherAddress.number} onChange={e=>setOtherAddress({...otherAddress,number:e.target.value})}/><input placeholder="Complemento" value={otherAddress.complement} onChange={e=>setOtherAddress({...otherAddress,complement:e.target.value})}/></div>}<div className="delivery-fee"><span>Taxa de entrega</span><b>{money(deliveryFee)}</b></div></div>}
      <h4>Molhos</h4>
      {sauces.length ? (
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {sauces.map((sauce) => {
            const checked = selectedSauceIds.includes(sauce.id);
            return (
              <label key={sauce.id} className={`flex cursor-pointer items-center gap-3 border p-3 ${checked ? "border-recanto-red bg-[#fff7ed]" : "border-recanto-line bg-white"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelectedSauceIds(checked ? selectedSauceIds.filter((id) => id !== sauce.id) : [...selectedSauceIds, sauce.id])}
                />
                <span><b className="block">{sauce.name}</b>{Number(sauce.additionalPrice) > 0 && <small className="text-[#777]">+ {money(sauce.additionalPrice)}</small>}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[#777]">Nenhum molho disponível no momento.</p>
      )}
      <label className="note">
        Observação para a cozinha
        <textarea
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="Ex.: sem cebola..."
        />
      </label>
      <div className="checkout-total">
        <span>Total do pedido</span>
        <b>{money(total)}</b>
      </div>
      {session?.user.role === "ADMIN" && (
        <div className="mb-5 border-2 border-recanto-red bg-[#fff7ed] p-4">
          <p className="eyebrow mb-2">PEDIDO NO ESTABELECIMENTO</p>
          <h4 className="mt-0">Pagamento presencial</h4>
          <p className="text-sm leading-6 text-[#666]">O pedido entra imediatamente no painel como não pago. Use a observação acima para informar a mesa ou o nome do cliente.</p>
          <button
            type="button"
            className="primary wide"
            disabled={creatingInPerson}
            onClick={async () => {
              setCreatingInPerson(true);
              setPaymentError("");
              try { await createInPerson(); }
              catch (error) { setPaymentError((error as Error).message); }
              finally { setCreatingInPerson(false); }
            }}
          >
            {creatingInPerson ? "Criando pedido..." : "Confirmar pedido presencial"}
          </button>
        </div>
      )}
      <h4>Pagamento seguro</h4>
      {mercadoPagoTestMode&&<p className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">Ambiente de testes: cartões reais não são aprovados. Use um cartão de teste do Mercado Pago; nenhuma cobrança real será realizada.</p>}
      {paymentError&&<p className="form-error">{paymentError}</p>}
      {mercadoPagoPublicKey ? (
        <Payment
          initialization={paymentInitialization}
          customization={paymentCustomization}
          locale="pt"
          onSubmit={handlePaymentSubmit}
          onError={handlePaymentError}
        />
      ) : <p className="form-error">Public Key do Mercado Pago não configurada.</p>}
    </>
  );
}

function CardPending({result,back}:{result:any;back:()=>void}){
  return <div className="min-h-full py-8 text-center"><p className="eyebrow">PAGAMENTO COM CARTÃO</p><h2>Pagamento em análise</h2><p className="mx-auto max-w-md text-sm leading-6 text-[#666]">{paymentStatusMessage(result.payment?.status,result.payment?.statusDetail)}</p><p className="mt-4 text-xs text-[#777]">O pedido ainda não foi enviado para preparação. Quando o Mercado Pago aprovar, ele será liberado automaticamente no painel administrativo.</p><button type="button" className="outline wide mt-6" onClick={back}>Tentar outro pagamento</button></div>;
}

function PixPending({result}:{result:any}){
  const payment=result.payment;
  const [copyStatus,setCopyStatus]=useState("");
  const code=payment.qrCode||"";
  async function copyPix(){
    if(!code){setCopyStatus("Código Pix indisponível.");return;}
    try{
      if(!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(code);
    }catch{
      const field=document.createElement("textarea");
      field.value=code;
      field.style.position="fixed";
      field.style.opacity="0";
      document.body.appendChild(field);
      field.focus();
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopyStatus("Código Pix copiado!");
  }
  return <div className="min-h-full py-4 pb-24 text-center"><p className="eyebrow">PAGAMENTO PIX</p><h2>Escaneie o QR Code</h2><p className="text-sm text-[#666]">O pedido será confirmado automaticamente após o pagamento.</p>{payment.qrCodeBase64&&<img className="mx-auto my-5 h-auto w-[min(15rem,70vw)]" src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR Code Pix"/>}<label className="note text-left">Pix copia e cola<textarea className="max-h-28 break-all text-xs" readOnly value={code} onFocus={(event)=>event.currentTarget.select()} onClick={(event)=>event.currentTarget.select()}/></label>{copyStatus&&<p className="my-3 text-sm font-bold text-[#24652c]" role="status">{copyStatus}</p>}<div className="sticky bottom-0 mt-4 bg-[#fffaf1] py-3"><button type="button" className="outline wide min-h-12" disabled={!code} onClick={copyPix}>Copiar código Pix</button></div></div>
}
function Tracking({
  order,
  total,
  back,
}: {
  order: ApiOrder;
  total: number;
  back: () => void;
}) {
  const preparing = [
      "PREPARING",
      "OUT_FOR_DELIVERY",
      "READY_FOR_PICKUP",
      "COMPLETED",
    ].includes(order.status),
    sent = ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "COMPLETED"].includes(
      order.status,
    );
  return (
    <main className="tracking-page">
      <header className="simple-header">
        <Brand />
        <small>Atualização automática a cada 8 segundos</small>
      </header>
      <section className="tracking-card">
        <div className="success-mark">✓</div>
        <p className="eyebrow">PEDIDO {order.code}</p>
        <h1>
          {order.status === "COMPLETED"
            ? "Pedido concluído. Bom apetite!"
            : "Seu pedido está sendo preparado com carinho!"}
        </h1>
        <div className="timeline">
          <div className="step active">
            <span>✓</span>
            <b>Pedido confirmado</b>
          </div>
          <div className={`line ${preparing ? "active" : ""}`} />
          <div className={`step ${preparing ? "active current" : ""}`}>
            <span>♨</span>
            <b>Em preparação</b>
          </div>
          <div className={`line ${sent ? "active" : ""}`} />
          <div className={`step ${sent ? "active current" : ""}`}>
            <span>{order.fulfillmentType === "DELIVERY" ? "🛵" : "🏪"}</span>
            <b>
              {order.fulfillmentType === "DELIVERY"
                ? "Saiu para entrega"
                : "Pronto para retirada"}
            </b>
          </div>
        </div>
        <div className="order-summary">
          <div>
            <span>Status atual</span>
            <b>{statusLabel[order.status]}</b>
          </div>
          <div>
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
        </div>
        <button className="outline wide" onClick={back}>
          Voltar ao cardápio
        </button>
      </section>
    </main>
  );
}
function Admin({
  session,
  orders,
  products,
  ingredients,
  back,
  refresh,
  show,
}: {
  session: Session;
  orders: ApiOrder[];
  products: Product[];
  ingredients: Ingredient[];
  back: () => void;
  refresh: () => void;
  show: (s: string) => void;
}) {
  const [tab, setTab] = useState("Pedidos"),
    [modal, setModal] = useState(false);
  async function advance(o: ApiOrder) {
    const next = statusNext[o.status];
    if (!next) return;
    try {
      await api(
        `/admin/orders/${o.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status: next }) },
        session.accessToken,
      );
      show("Status atualizado e cliente notificado");
      refresh();
    } catch (e) {
      show((e as Error).message);
    }
  }
  async function addProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(
        "/admin/catalog/products",
        {
          method: "POST",
          body: JSON.stringify({ ...d, price: Number(d.price), active: true }),
        },
        session.accessToken,
      );
      setModal(false);
      refresh();
      show("Produto cadastrado");
    } catch (e) {
      show((e as Error).message);
    }
  }
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  return (
    <main className="admin">
      <aside className="side">
        <Brand />
        <nav>
          {["Pedidos", "Produtos", "Ingredientes"].map((x) => (
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
          <button className="new" onClick={() => setModal(true)}>
            ＋ Novo produto
          </button>
        </header>
        <div className="stats">
          <div>
            <span>Pedidos</span>
            <b>{orders.length}</b>
            <small>Histórico total</small>
          </div>
          <div>
            <span>Em preparo</span>
            <b>{orders.filter((o) => o.status === "PREPARING").length}</b>
          </div>
          <div>
            <span>Faturamento</span>
            <b>{money(revenue)}</b>
          </div>
          <div>
            <span>Produtos ativos</span>
            <b>{products.filter((p) => p.active).length}</b>
          </div>
        </div>
        {tab === "Pedidos" ? (
          <div className="order-table">
            <div className="tr th">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Itens</span>
              <span>Total</span>
              <span>Status</span>
              <span>Ação</span>
            </div>
            {orders.map((o) => (
              <div className="tr" key={o.id}>
                <b>
                  {o.code}
                  <small>{new Date(o.createdAt).toLocaleString("pt-BR")}</small>
                </b>
                <span>
                  {o.user.fullName}
                  <small>
                    {o.fulfillmentType === "DELIVERY" ? "Entrega" : "Retirada"}
                  </small>
                </span>
                <span>
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  <small className="note-text">
                    {o.observation || "Sem observação"}
                  </small>
                </span>
                <b>{money(o.total)}</b>
                <span>
                  <i
                    className={`status ${statusLabel[o.status]?.replaceAll(" ", "").toLowerCase()}`}
                  >
                    {statusLabel[o.status]}
                  </i>
                </span>
                <button
                  className="advance"
                  disabled={!statusNext[o.status]}
                  onClick={() => advance(o)}
                >
                  {statusNext[o.status] ? "Avançar status →" : "Finalizado"}
                </button>
              </div>
            ))}
          </div>
        ) : tab === "Produtos" ? (
          <div className="admin-cards">
            {products.map((p) => (
              <div key={p.id}>
                <b>{p.name}</b>
                <span>{categoryLabel[p.category]}</span>
                <strong>{money(p.price)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-cards">
            {ingredients.map((i) => (
              <div key={i.id}>
                <b>{i.name}</b>
                <span>{i.active ? "Disponível" : "Indisponível"}</span>
                <strong>+ {money(i.additionalPrice)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <form
            className="modal"
            onSubmit={addProduct}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="close"
              onClick={() => setModal(false)}
            >
              ×
            </button>
            <p className="eyebrow">CARDÁPIO</p>
            <h2>Novo produto</h2>
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Descrição
              <textarea name="description" required />
            </label>
            <div className="form-row">
              <label>
                Categoria
                <select name="category">
                  <option value="PASTEL">Pastel</option>
                  <option value="DRINK">Bebida</option>
                  <option value="DESSERT">Doce</option>
                </select>
              </label>
              <label>
                Preço
                <input name="price" type="number" step="0.01" required />
              </label>
            </div>
            <button className="primary wide">Cadastrar produto</button>
          </form>
        </div>
      )}
    </main>
  );
}
