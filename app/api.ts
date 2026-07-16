export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export type SessionUser = { id:string; email:string; fullName:string; role:"CUSTOMER"|"ADMIN"; phone?:string; cep?:string; street?:string; number?:string; complement?:string };
export type Session = { accessToken:string; user:SessionUser };

export async function api<T>(path:string, options:RequestInit = {}, token?:string):Promise<T>{
  const response=await fetch(`${API_URL}${path}`,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}});
  if(!response.ok){const body=await response.json().catch(()=>({}));const message=Array.isArray(body.message)?body.message.join(", "):body.message;throw new Error(message||"Não foi possível concluir a operação")}
  return response.json();
}

export function loadSession():Session|null {if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem("recanto.session")||"null")}catch{return null}}
export function saveSession(session:Session|null){if(typeof window==="undefined")return;session?localStorage.setItem("recanto.session",JSON.stringify(session)):localStorage.removeItem("recanto.session")}
