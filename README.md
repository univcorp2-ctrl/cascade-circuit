# Cascade Circuit

![Cascade Circuit architecture](docs/assets/readme-architecture.svg)

**落として、3つつないで、連鎖を起こす。** 6列のボードへエネルギー球を落とし、同じレベルが上下左右に3個以上つながると1段階進化します。落下後の盤面変化でさらに3個以上がつながると連鎖倍率が上がる、1プレイ約3分のオリジナルWebパズルです。

## Live app

- Production: https://cascade-circuit.pages.dev
- GitHub Actions: https://github.com/univcorp2-ctrl/cascade-circuit/actions

> 既存ゲームのコード・名称・画像・音声・問題データはコピーしていません。広く知られた「落下」「同値合成」「日替わり挑戦」という抽象的な遊びの要素を再構成し、3個以上の連結判定、連鎖倍率、36手制、6×8盤面という独自ルールにしています。

## 今回の操作性改善

- 初回に20秒のアニメーション付きチュートリアルを表示
- 次に落ちるコアを `NEXT` で常時表示
- 各列ボタンに次のコアと「ここへ落とす」を表示
- ホバー・フォーカスした列を盤面上で発光
- コアが上から落ちるバウンドアニメーション
- 合体時の盤面フラッシュ、コア反応、得点・連鎖ポップアップ
- 画面内へ「同じ色を上下左右に3個以上」というルールを固定表示
- `prefers-reduced-motion` に対応

## 実装済み

- React + TypeScript + ViteのレスポンシブゲームUI
- 6×8ボード、列ドロップ、上下左右の同値3個以上合成、重力、複数連鎖
- 日付シード、36手制、スコア、最大レベル、ベストスコア、Web Share
- 無料枠: ローカル日付ごとに5ラウンド
- Premium: 月額 / 年額のStripe Checkoutサブスクリプション
- Checkout nonce照合、Stripeサブスクリプション状態確認、HMAC署名HttpOnly Cookie
- Stripe Customer Portalによる解約・支払方法変更のセルフサービス導線
- Cloudflare Pages Functionsの `/api/create-checkout`、`/api/verify-session`、`/api/entitlement`、`/api/create-portal`
- プライバシー、利用規約、特商法表記の初期テンプレート
- Vitest、TypeScript型検査、GitHub Actions、devcontainer、Cloudflare Pages

## 収益モデル

無料ユーザーは登録なしで1日5回プレイできます。6回目にPaywallを表示し、月額480円または年額3,800円のPremiumへ誘導します。実際の請求額はStripe Price設定を正としてください。Premiumは無制限プレイ、広告なし、テーマ、将来モードの先行解放を想定しています。

決済はStripeホスト型Checkoutです。カードに加え、利用者の端末・ブラウザ・Stripe設定・地域が対応している場合はApple Pay / Google Pay等がCheckoutに表示されます。購入後はヘッダーの「契約管理」からStripe Customer Portalへ移動できます。

## ローカル起動

```bash
npm install
npm run dev
```

## 品質確認

```bash
npm run lint
npm test
npm run build
```

## アーキテクチャ

```mermaid
flowchart LR
  U[Player] -->|play| R[React UI]
  R --> E[Pure TypeScript game engine]
  R --> L[(localStorage\nfree quota + best)]
  R -->|POST plan| C[Pages Function\ncreate-checkout]
  C -->|Checkout Session| S[Stripe Checkout]
  S -->|success session_id| V[Pages Function\nverify-session]
  V -->|verify nonce + subscription| S
  V -->|signed HttpOnly cookie| R
  R -->|GET entitlement| A[Pages Function\nentitlement]
  A -->|active / trialing?| S
  R -->|POST| B[Pages Function\ncreate-portal]
  B -->|Customer Portal| S
  G[GitHub Actions] -->|typecheck / test / build| D[dist artifact]
  D --> P[Cloudflare Pages]
```

設計の詳細は [`docs/architecture.md`](docs/architecture.md)、本番決済設定は [`docs/setup.md`](docs/setup.md) にあります。

## 本番前に必須の設定

- `STRIPE_SECRET_KEY`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_YEARLY_PRICE_ID`
- `ENTITLEMENT_SECRET`
- `APP_URL`

Stripeで月額・年額のProduct/PriceとCustomer Portalを設定し、特商法表記・利用規約・返金条件・事業者連絡先を実情報へ差し替えてください。

## ライセンス

MIT。ブランド名、デザイン、コンテンツを商用公開する場合は運営者の法務・商標確認を行ってください。
