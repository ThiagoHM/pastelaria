"use client";

import { useMemo, useState } from "react";

type Product = { id: number; name: string; desc: string; price: number; category: string; emoji: string; tag?: string };
type CartItem = Product & { qty: number };

const products: Product[] = [
  { id: 1, name: "Pastel da Casa", desc: "Carne, queijo, tomate e nosso tempero secreto", price: 18.9, category: "Pastéis", emoji: "🥟", tag: "Mais pedido" },
  { id: 2, name: "Frango Cremoso", desc: "Frango desfiado, catupiry e milho", price: 17.5, category: "Pastéis", emoji: "🥟" },
  { id: 3, name: "Queijo Crocante", desc: "Muçarela, parmesão e orégano", price: 15.9, category: "Pastéis", emoji: "🧀", tag: "Vegetariano" },
  { id: 4, name: "Calabresa Acebolada", desc: "Calabresa artesanal, cebola e muçarela", price: 17.9, category: "Pastéis", emoji: "🌶️" },
  { id: 5, name: "Coca-Cola", desc: "Lata 350 ml, bem gelada", price: 6.5, category: "Bebidas", emoji: "🥤" },
  { id: 6, name: "Caldo de cana", desc: "Copo 500 ml, moído na hora", price: 8.0, category: "Bebidas", emoji: "🧃" },
  { id: 7, name: "Pastel de Chocolate", desc: "Chocolate ao leite e morangos", price: 16.9, category: "Doces", emoji: "🍫" },
  { id: 8, name: "Banana com Canela", desc: "Banana, doce de leite e canela", price: 14.9, category: "Doces", emoji: "🍌" },
];

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const [mode, setMode] = useState<"store" | "admin">("store");
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [delivery, setDelivery] = useState("Entrega");
  const [payment, setPayment] = useState("Pix");
  const [toast, setToast] = useState("");
  const [orders, setOrders] = useState([
    { id: "#1048", name: "Mariana Costa", items: "2× Pastel da Casa, 1× Coca-Cola", total: 44.3, status: "Novo", time: "Há 2 min", note: "Sem cebola, por favor" },
    { id: "#1047", name: "Rafael Alves", items: "1× Frango Cremoso, 1× Caldo de cana", total: 25.5, status: "Em preparo", time: "Há 12 min", note: "—" },
    { id: "#1046", name: "Ana Júlia", items: "3× Queijo Crocante", total: 47.7, status: "Saiu para entrega", time: "Há 28 min", note: "Interfone 32" },
  ]);

  const filtered = products.filter(p => (category === "Todos" || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()));
  const totalItems = cart.reduce((a, b) => a + b.qty, 0);
  const subtotal = cart.reduce((a, b) => a + b.price * b.qty, 0);
  const total = subtotal + (delivery === "Entrega" && cart.length ? 5 : 0);

  function add(product: Product) {
    setCart(old => old.some(i => i.id === product.id) ? old.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) : [...old, { ...product, qty: 1 }]);
    setToast(`${product.name} foi para a sacola`); setTimeout(() => setToast(""), 2200);
  }
  function qty(id: number, delta: number) { setCart(old => old.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)); }
  function advance(id: string) {
    setOrders(old => old.map(o => o.id === id ? { ...o, status: o.status === "Novo" ? "Em preparo" : o.status === "Em preparo" ? "Saiu para entrega" : "Concluído" } : o));
    setToast("Status atualizado e cliente notificado"); setTimeout(() => setToast(""), 2400);
  }

  if (mode === "admin") return <Admin orders={orders} advance={advance} setMode={setMode} toast={toast} />;

  if (orderDone) return (
    <main className="tracking-page">
      <header className="simple-header"><Brand /><button className="link-btn" onClick={() => setMode("admin")}>Painel do administrador →</button></header>
      <section className="tracking-card">
        <div className="success-mark">✓</div><p className="eyebrow">PEDIDO #1049 CONFIRMADO</p>
        <h1>Oba, seu pedido já está<br/>na nossa cozinha!</h1><p>Tempo estimado: <strong>35–45 minutos</strong></p>
        <div className="timeline">
          <div className="step active"><span>✓</span><b>Pedido confirmado</b><small>19:42</small></div>
          <div className="line active"/><div className="step active current"><span>♨</span><b>Em preparação</b><small>Agora</small></div>
          <div className="line"/><div className="step"><span>🛵</span><b>Saiu para entrega</b><small>Em breve</small></div>
        </div>
        <div className="order-summary"><div><span>Entrega em</span><b>Rua das Flores, 128</b></div><div><span>Total</span><b>{money(total)}</b></div></div>
        <button className="outline wide" onClick={() => { setOrderDone(false); setCheckout(false); setCart([]); }}>Voltar ao cardápio</button>
      </section>
    </main>
  );

  return (
    <main>
      {toast && <div className="toast">✓ {toast}</div>}
      <header className="header"><Brand /><nav><a href="#menu">Cardápio</a><a href="#about">Nossa história</a><a href="#contact">Contato</a></nav><div className="actions"><button className="login">Olá, Mariana⌄</button><button className="cart-btn" onClick={() => setCartOpen(true)}>Sacola <span>{totalItems}</span></button></div></header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">FEITO NA HORA, DO NOSSO JEITO</p><h1>Pastel bom é<br/><em>pastel de verdade.</em></h1><p>Massa crocante, recheio generoso e aquele sabor que faz você voltar.</p><button className="primary" onClick={() => document.getElementById("menu")?.scrollIntoView({behavior:"smooth"})}>Ver o cardápio <span>↓</span></button><div className="trust"><span>★ 4,9 no Google</span><span>•</span><span>Entrega em até 45 min</span></div></div>
        <div className="hero-art"><div className="sun"/><div className="plate"><div className="pastry">🥟</div></div><div className="burst b1">Crocante<br/><strong>por fora</strong></div><div className="burst b2">Recheado<br/><strong>por dentro</strong></div><div className="leaf l1">🌿</div><div className="leaf l2">🌶️</div></div>
      </section>
      <section className="menu-section" id="menu">
        <div className="section-top"><div><p className="eyebrow">ESCOLHA O SEU FAVORITO</p><h2>Nosso cardápio</h2></div><div className="search"><span>⌕</span><input aria-label="Buscar no cardápio" placeholder="Buscar no cardápio" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
        <div className="filters">{["Todos","Pastéis","Bebidas","Doces"].map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}<button className="custom" onClick={()=>setToast("Monte seu pastel: escolha até 5 ingredientes!")}>＋ Monte seu pastel</button></div>
        <div className="grid">{filtered.map(p=><article className="product" key={p.id}><div className={`product-img tone-${p.id%4}`}><span>{p.emoji}</span>{p.tag&&<b>{p.tag}</b>}</div><div className="product-info"><small>{p.category}</small><h3>{p.name}</h3><p>{p.desc}</p><div><strong>{money(p.price)}</strong><button aria-label={`Adicionar ${p.name}`} onClick={()=>add(p)}>＋</button></div></div></article>)}</div>
      </section>
      <section className="about" id="about"><div><p className="eyebrow">DESDE 1998</p><h2>Receita de família.<br/>Sabor que atravessa gerações.</h2></div><p>Todo pastel é aberto, recheado e frito na hora. A gente acredita que comida simples, feita com capricho, é a que deixa as melhores lembranças.</p></section>
      <footer id="contact"><Brand/><p>Rua das Palmeiras, 450 • Centro<br/>Ter–Dom, 17h às 23h</p><button className="link-btn" onClick={()=>setMode("admin")}>Acesso administrativo →</button></footer>
      {cartOpen && <div className="overlay" onClick={()=>setCartOpen(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCartOpen(false)}>×</button>{!checkout ? <><p className="eyebrow">SEU PEDIDO</p><h2>Minha sacola <span>{totalItems} itens</span></h2>{cart.length===0?<div className="empty"><span>🥟</span><h3>Sua sacola está vazia</h3><p>Tem muita coisa gostosa esperando por você.</p></div>:<><div className="cart-list">{cart.map(i=><div className="cart-item" key={i.id}><span className="mini">{i.emoji}</span><div><b>{i.name}</b><small>{money(i.price)}</small></div><div className="counter"><button onClick={()=>qty(i.id,-1)}>−</button><span>{i.qty}</span><button onClick={()=>qty(i.id,1)}>＋</button></div></div>)}</div><div className="totals"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>Entrega</span><b>{money(5)}</b></p><p className="grand"><span>Total</span><b>{money(subtotal+5)}</b></p></div><button className="primary wide" onClick={()=>setCheckout(true)}>Continuar para pagamento →</button></>}</>:<Checkout delivery={delivery} setDelivery={setDelivery} payment={payment} setPayment={setPayment} total={total} back={()=>setCheckout(false)} confirm={()=>{setCartOpen(false);setOrderDone(true)}}/>}</aside></div>}
    </main>
  );
}

function Brand(){return <div className="brand"><span>PASTELARIA</span><strong>DO <i>ZECA</i></strong></div>}

function Checkout({delivery,setDelivery,payment,setPayment,total,back,confirm}:{delivery:string,setDelivery:(v:string)=>void,payment:string,setPayment:(v:string)=>void,total:number,back:()=>void,confirm:()=>void}){
 return <><button className="back" onClick={back}>← Voltar</button><p className="eyebrow">FINALIZAR PEDIDO</p><h2>Entrega e pagamento</h2><h4>Como você quer receber?</h4><div className="choice-row">{["Entrega","Retirada"].map(v=><button className={delivery===v?"selected":""} onClick={()=>setDelivery(v)} key={v}><span>{v==="Entrega"?"🛵":"🏪"}</span><b>{v}</b><small>{v==="Entrega"?"35–45 min":"20–30 min"}</small></button>)}</div>{delivery==="Entrega"&&<div className="address"><span>⌖</span><div><small>Entregar em</small><b>Rua das Flores, 128</b><p>Centro • CEP 01010-000</p></div><button>Alterar</button></div>}<h4>Forma de pagamento</h4><div className="pay-list">{[["Pix","◆","Aprovação imediata"],["Cartão de crédito","▣","Visa final 4821"],["Cartão de débito","▤","Na entrega"]].map(v=><button className={payment===v[0]?"selected":""} onClick={()=>setPayment(v[0])} key={v[0]}><span>{v[1]}</span><div><b>{v[0]}</b><small>{v[2]}</small></div><i>{payment===v[0]?"●":"○"}</i></button>)}</div><label className="note">Observação para a cozinha<textarea placeholder="Ex.: tirar cebola, caprichar no molho..."/></label><div className="checkout-total"><span>Total do pedido</span><b>{money(total)}</b></div><button className="primary wide" onClick={confirm}>Confirmar pedido →</button></>
}

function Admin({orders,advance,setMode,toast}:{orders:any[],advance:(id:string)=>void,setMode:(v:"store")=>void,toast:string}){
 const [tab,setTab]=useState("Pedidos"); const [modal,setModal]=useState(false);
 return <main className="admin"><aside className="side"><Brand/><nav>{["▦  Visão geral","▤  Pedidos","◇  Produtos","◉  Ingredientes","▧  Clientes"].map(x=><button key={x} className={x.includes(tab)?"active":""} onClick={()=>setTab(x.split("  ")[1])}>{x}</button>)}</nav><div className="side-bottom"><button onClick={()=>setMode("store")}>↗ Ver loja</button><div className="admin-user"><span>ZM</span><div><b>Zeca Martins</b><small>Administrador</small></div></div></div></aside><section className="admin-main">{toast&&<div className="toast">✓ {toast}</div>}<header><div><p>SEGUNDA-FEIRA, 13 DE JULHO</p><h1>{tab}</h1></div><div><button className="bell">♢<i>3</i></button><button className="new" onClick={()=>setModal(true)}>＋ Novo produto</button></div></header><div className="stats"><div><span>Pedidos hoje</span><b>24</b><small className="green">↑ 12% esta semana</small></div><div><span>Em preparo</span><b>6</b><small>Tempo médio: 18 min</small></div><div><span>Faturamento hoje</span><b>R$ 1.284,60</b><small className="green">↑ 8,4% esta semana</small></div><div><span>Ticket médio</span><b>R$ 53,52</b><small>24 pedidos</small></div></div><div className="orders-head"><div><h2>Pedidos recentes</h2><span>3 precisam de atenção</span></div><div className="admin-filter"><button className="active">Todos</button><button>Novos</button><button>Em preparo</button><button>Entrega</button></div></div><div className="order-table"><div className="tr th"><span>Pedido</span><span>Cliente</span><span>Itens</span><span>Total</span><span>Status</span><span>Ação</span></div>{orders.map(o=><div className="tr" key={o.id}><b>{o.id}<small>{o.time}</small></b><span>{o.name}<small>Entrega</small></span><span>{o.items}<small className="note-text">{o.note!=="—"?`Obs: ${o.note}`:"Sem observação"}</small></span><b>{money(o.total)}</b><span><i className={`status ${o.status.replaceAll(" ","").toLowerCase()}`}>{o.status}</i></span><button className="advance" onClick={()=>advance(o.id)}>{o.status==="Novo"?"Aceitar pedido":o.status==="Em preparo"?"Saiu p/ entrega":o.status==="Saiu para entrega"?"Concluir":"Ver pedido"} →</button></div>)}</div></section>{modal&&<div className="overlay" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(false)}>×</button><p className="eyebrow">CARDÁPIO</p><h2>Novo produto</h2><label>Nome do produto<input placeholder="Ex.: Pastel de palmito"/></label><div className="form-row"><label>Categoria<select><option>Pastéis</option><option>Bebidas</option><option>Doces</option></select></label><label>Preço<input placeholder="R$ 0,00"/></label></div><label>Descrição<textarea placeholder="Ingredientes e detalhes do produto"/></label><label className="check"><input type="checkbox"/> Disponível no cardápio</label><button className="primary wide" onClick={()=>setModal(false)}>Cadastrar produto</button></div></div>}</main>
}
