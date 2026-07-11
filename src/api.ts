export interface Entitlement { premium: boolean; status?: string; }

export async function fetchEntitlement(): Promise<Entitlement> {
  try {
    const response = await fetch('/api/entitlement', { credentials: 'include' });
    if (!response.ok) return { premium: false };
    return await response.json() as Entitlement;
  } catch {
    return { premium: false };
  }
}

export async function verifyCheckout(sessionId: string): Promise<Entitlement> {
  const response = await fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  if (!response.ok) throw new Error('購入状態を確認できませんでした');
  return await response.json() as Entitlement;
}

export async function beginCheckout(plan: 'monthly' | 'yearly'): Promise<void> {
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ plan }),
  });
  const data = await response.json() as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? '決済を開始できませんでした');
  window.location.assign(data.url);
}

export async function openBillingPortal(): Promise<void> {
  const response = await fetch('/api/create-portal', {
    method: 'POST',
    credentials: 'include',
  });
  const data = await response.json() as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? '契約管理画面を開けませんでした');
  window.location.assign(data.url);
}
