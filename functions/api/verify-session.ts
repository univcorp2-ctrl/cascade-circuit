import { json, readCookie, secureCookie, signEntitlement, stripeRequest, type EntitlementPayload, type Env } from '../lib';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId?.startsWith('cs_')) return json({ premium: false, error: 'セッションIDが不正です' }, 400);
  if (!env.STRIPE_SECRET_KEY || !env.ENTITLEMENT_SECRET) return json({ premium: false, error: '決済Secretsが未設定です' }, 503);

  const response = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
  const session = await response.json() as { status?: string; client_reference_id?: string; customer?: string; subscription?: string | { id?: string; status?: string }; error?: { message?: string } };
  if (!response.ok) return json({ premium: false, error: session.error?.message ?? '購入情報を取得できませんでした' }, 502);
  const nonce = readCookie(request, 'cascade_checkout_nonce');
  if (!nonce || session.client_reference_id !== nonce) return json({ premium: false, error: '購入セッションを検証できませんでした' }, 403);

  const subscription = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const subscriptionStatus = typeof session.subscription === 'object' ? session.subscription?.status : undefined;
  if (session.status !== 'complete' || !subscription || (subscriptionStatus && !['active', 'trialing'].includes(subscriptionStatus))) return json({ premium: false, status: session.status }, 402);

  const payload: EntitlementPayload = { subscription, customer: session.customer ?? '', exp: Date.now() + 86400000 };
  const token = await signEntitlement(payload, env.ENTITLEMENT_SECRET);
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  headers.append('set-cookie', secureCookie('cascade_premium', token, 86400));
  headers.append('set-cookie', secureCookie('cascade_checkout_nonce', '', 0));
  return new Response(JSON.stringify({ premium: true, status: subscriptionStatus ?? 'active' }), { status: 200, headers });
};
