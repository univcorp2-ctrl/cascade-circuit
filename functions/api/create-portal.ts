import { json, readCookie, stripeRequest, verifyEntitlement, type Env } from '../lib';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.ENTITLEMENT_SECRET) return json({ error: '決済Secretsが未設定です' }, 503);

  const entitlement = await verifyEntitlement(readCookie(request, 'cascade_premium'), env.ENTITLEMENT_SECRET);
  if (!entitlement?.customer) return json({ error: '有効なPremium契約が見つかりません' }, 401);

  const origin = env.APP_URL || new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set('customer', entitlement.customer);
  params.set('return_url', origin);

  const response = await stripeRequest(env, '/billing_portal/sessions', { method: 'POST', body: params });
  const portal = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !portal.url) return json({ error: portal.error?.message ?? 'Stripe Customer Portalの作成に失敗しました' }, 502);
  return json({ url: portal.url });
};
