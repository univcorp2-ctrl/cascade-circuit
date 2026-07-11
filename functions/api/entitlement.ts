import { json, readCookie, secureCookie, signEntitlement, stripeRequest, verifyEntitlement, type Env } from '../lib';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ENTITLEMENT_SECRET || !env.STRIPE_SECRET_KEY) return json({ premium: false });
  const payload = await verifyEntitlement(readCookie(request, 'cascade_premium'), env.ENTITLEMENT_SECRET);
  if (!payload) return json({ premium: false });
  const response = await stripeRequest(env, `/subscriptions/${encodeURIComponent(payload.subscription)}`);
  const subscription = await response.json() as { status?: string };
  const premium = response.ok && ['active', 'trialing'].includes(subscription.status ?? '');
  if (!premium) return json({ premium: false, status: subscription.status ?? 'inactive' }, 200, { 'set-cookie': secureCookie('cascade_premium', '', 0) });
  const refreshed = await signEntitlement({ ...payload, exp: Date.now() + 86400000 }, env.ENTITLEMENT_SECRET);
  return json({ premium: true, status: subscription.status }, 200, { 'set-cookie': secureCookie('cascade_premium', refreshed, 86400) });
};
