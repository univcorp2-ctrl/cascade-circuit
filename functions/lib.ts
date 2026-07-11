export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_MONTHLY_PRICE_ID: string;
  STRIPE_YEARLY_PRICE_ID: string;
  ENTITLEMENT_SECRET: string;
  APP_URL?: string;
}
export interface EntitlementPayload { subscription: string; customer: string; exp: number; }
export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
export async function stripeRequest(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.stripe.com/v1${path}`, { ...init, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded', ...(init?.headers ?? {}) } });
}
export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) { const [key, ...value] = part.trim().split('='); if (key === name) return value.join('='); }
  return null;
}
export async function signEntitlement(payload: EntitlementPayload, secret: string): Promise<string> {
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body, secret)}`;
}
export async function verifyEntitlement(token: string | null, secret: string): Promise<EntitlementPayload | null> {
  if (!token) return null;
  const [body, providedSignature] = token.split('.');
  if (!body || !providedSignature || !timingSafeEqual(providedSignature, await hmac(body, secret))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as EntitlementPayload;
    return payload.exp > Date.now() && payload.subscription ? payload : null;
  } catch { return null; }
}
export function secureCookie(name: string, value: string, maxAge: number): string { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function base64Url(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function base64UrlDecode(value: string): Uint8Array { const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
async function hmac(value: string, secret: string): Promise<string> { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))); }
function timingSafeEqual(left: string, right: string): boolean { if (left.length !== right.length) return false; let difference = 0; for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index); return difference === 0; }
