# Production setup

ゲーム本体とPages公開は自動化されています。実決済を有効化するために、外部サービス側で次の設定だけが必要です。秘密値はChatGPT、GitHub、READMEへ貼らず、CloudflareのSecretとして保存してください。

## 1. Stripe Product / Price

1. Stripe DashboardでProduct `Cascade+ Premium` を作成します。
2. 月額のrecurring PriceをJPY 480で作り、Price IDを控えます。
3. 年額のrecurring PriceをJPY 3,800で作り、Price IDを控えます。
4. 最初はStripe Sandbox/Test modeで確認します。
5. CheckoutでCardsを有効化します。Apple Pay / Google Payは対応端末・地域・ブラウザ・Stripe設定で表示されます。

## 2. Cloudflare Pages Secrets

Cloudflare Dashboard → Workers & Pages → `cascade-circuit` → Settings → Variables and Secretsで、ProductionとPreviewに設定します。

| Name | Type | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret | Stripe secret key |
| `STRIPE_MONTHLY_PRICE_ID` | Secret | 月額Price ID |
| `STRIPE_YEARLY_PRICE_ID` | Secret | 年額Price ID |
| `ENTITLEMENT_SECRET` | Secret | 32bytes以上のランダム値 |
| `APP_URL` | Variable | `https://<production-domain>` |

Cloudflareの通常変数は暗号化されないため、Stripe keyと署名Secretは必ずSecretとして保存します。

## 3. 再デプロイ

Variables and Secrets保存後、Cloudflare Pagesの最新DeploymentをRetry deploymentします。`/api/create-checkout` が503ではなくCheckout URLを返せば設定済みです。

## 4. 本番確認

1. 無料プレイを開始し、列ボタンとキーボード1〜6を確認
2. 5回消費後にPaywallが出ることを確認
3. Stripe Test cardで月額Checkoutを完了
4. success URLからPremium表示になることを確認
5. ブラウザ更新後もPremiumが維持されることを確認
6. Stripe側でsubscriptionをcancelし、再読込で無料へ戻ることを確認
7. Safari / iPhone等の対応環境でApple Pay表示を確認

## 5. 法務・運用

実課金を開始する前に `public/commercial.html`、`public/terms.html`、`public/privacy.html` の運営者情報、連絡先、返金条件、解約方法を実情報へ差し替えます。Stripe Customer Portalを有効化し、利用者が自分で解約・支払方法変更できる導線を追加することを推奨します。

## 6. ローカル決済確認

`.dev.vars` を作成して同じ変数を入れます。このファイルは `.gitignore` 対象です。通常の `npm run dev` はフロントエンドのみなので、Pages Functionsを含めて確認する場合はCloudflareのローカル開発コマンドを利用してください。
