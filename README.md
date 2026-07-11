# Cascade Circuit

![Cascade Circuit architecture](docs/assets/readme-architecture.svg)

**同じ色を3つにするだけ。** 6列の盤面で置きたい列を直接タップし、同じ色が上下左右に3個以上つながると1段階進化します。

## Live app

- Production: https://cascade-circuit.pages.dev
- GitHub Actions: https://github.com/univcorp2-ctrl/cascade-circuit/actions

## 2026-07 UX rebuild

ユーザーテストで「説明を読んでも遊び方が分からない」という問題があったため、説明量を増やす方式をやめ、盤面そのものをチュートリアルに作り直しました。

- ゲーム画面をページ先頭へ移動
- 盤面の列全体を直接タップできる操作へ変更
- 初期盤面へ同色2個を配置し、最初の1手で必ず合体を体験
- 正解列へ「ここをタップ」を表示
- 落下予定位置へ半透明の球を表示
- 「次に落ちる球」を盤面上へ大きく表示
- 合体時に `3つ → 1つ` と得点を中央表示
- 課金説明や長いマーケティング表示をプレイ画面から削減
- 斜めは無効というルールを常時表示
- スマートフォンでも列全体をタップ可能

## ゲームルール

1. 6本の列から置きたい列をタップ
2. `NEXT` の球がその列の一番下へ落下
3. 同じ色が上下または左右に3個以上つながると合体
4. 合体後に再び3個つながると連鎖
5. 36手でスコアを競う

## 実装済み

- React + TypeScript + Vite
- 6×8盤面、列ドロップ、同値3個以上合成、重力、複数連鎖
- 推奨列計算と落下地点プレビュー
- 初手で必ずルールを体験できる初期盤面
- 日付シード、36手制、ベストスコア
- 1日5ラウンドの無料枠
- Stripe Checkout月額・年額サブスクリプション
- Stripe Customer Portal
- Cloudflare Pages Functions
- Vitest、TypeScript型検査、GitHub Actions、Cloudflare Pages

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

決済と本番設定は [`docs/setup.md`](docs/setup.md)、設計は [`docs/architecture.md`](docs/architecture.md) を参照してください。
