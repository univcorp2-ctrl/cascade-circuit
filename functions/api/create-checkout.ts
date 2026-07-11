import { json, secureCookie, stripeRequest, type Env } from '../lib';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_MONTHLY_PRICE_ID || !env.STRIPE_YEARLY_PRICE_ID) return json({ error: 'Stripeが未設定です。docs/setup.mdのSecretsを登録してください。' }, 503);
  let plan: 'monthly' | 'yearly';
  try {
    const body = await request.json() as { plan?: string };
    if (body.plan !== 'monthly' && body.plan !== 'yearly') return json({ error: '不正なプランです' }, 400);
    plan = body.plan;
  } catch { return json({ error: 'JSON形式のリクエストが必要です' }, 400); }

  const origin = env.APP_URL || new URL(request.url).origin;
  const price = plan === 'monthly' ? env.STRIPE_MONTHLY_PRICE_ID : env.STRIPE_YEARLY_PRICE_ID;
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', price);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/?checkout=cancelled`);
  params.set('client_reference_id', nonce);
  params.set('allow_promotion_codes', 'true');
  params.set('locale', 'auto');
  params.set('metadata[product]', 'cascade-circuit-premium');
  params.set('metadata[plan]', plan);

  const response = await stripeRequest(env, '/checkout/sessions', { method: 'POST', body: params });
  const session = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !session.url) return json({ error: session.error?.message ?? 'Stripe Checkoutの作成に失敗しました' }, 502);
  return json({ url: session.url }, 200, { 'set-cookie': secureCookie('cascade_checkout_nonce', nonce, 3600) });
};
