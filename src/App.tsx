import { useEffect, useMemo, useState } from 'react';
import { beginCheckout, fetchEntitlement, verifyCheckout } from './api';
import { COLS, createGame, dropInColumn, type GameState } from './game/engine';
import { consumeFreePlay, readBestScore, remainingFreePlays, saveBestScore } from './game/storage';
import './styles.css';

type Phase = 'intro' | 'playing' | 'over';
const tileLabels: Record<number, string> = { 1: '⚡', 2: '✦', 3: '◆', 4: '✹', 5: '⬢', 6: '✺', 7: '◈', 8: '✷', 9: '✸' };

export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [phase, setPhase] = useState<Phase>('intro');
  const [premium, setPremium] = useState(false);
  const [remaining, setRemaining] = useState(() => remainingFreePlays());
  const [best, setBest] = useState(() => readBestScore());
  const [showPaywall, setShowPaywall] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('checkout') === 'success' && sessionId) {
      verifyCheckout(sessionId)
        .then((result) => {
          setPremium(result.premium);
          setNotice(result.premium ? 'Premiumが有効になりました。無制限で遊べます！' : '購入確認が完了していません。');
        })
        .catch((error: Error) => setNotice(error.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    } else {
      fetchEntitlement().then((result) => setPremium(result.premium));
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase !== 'playing') return;
      const column = Number(event.key) - 1;
      if (column >= 0 && column < COLS) handleDrop(column);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const missionProgress = useMemo(() => Math.min(100, Math.round((game.maxTile / 8) * 100)), [game.maxTile]);

  function startRound() {
    if (!premium && remaining <= 0) {
      setShowPaywall(true);
      return;
    }
    if (!premium) setRemaining(consumeFreePlay());
    setGame(createGame());
    setPhase('playing');
    setNotice('');
  }

  function handleDrop(column: number) {
    const result = dropInColumn(game, column);
    if (!result.accepted) {
      setGame(result.state);
      return;
    }
    setGame(result.state);
    if (result.state.gameOver) {
      setBest(saveBestScore(result.state.score));
      setPhase('over');
    }
  }

  async function checkout(plan: 'monthly' | 'yearly') {
    setCheckoutBusy(true);
    setNotice('');
    try {
      await beginCheckout(plan);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '決済を開始できませんでした');
      setCheckoutBusy(false);
    }
  }

  async function shareScore() {
    const text = `Cascade Circuitで ${game.score.toLocaleString()}点・最大Lv.${game.maxTile}！ #CascadeCircuit`;
    try {
      if (navigator.share) await navigator.share({ title: 'Cascade Circuit', text, url: window.location.origin });
      else await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
      setNotice('結果を共有しました');
    } catch {
      setNotice('共有をキャンセルしました');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cascade Circuit home">
          <span className="brand-mark">C</span>
          <span><strong>CASCADE</strong><small>CIRCUIT</small></span>
        </a>
        <div className="header-actions">
          <span className={`plan-pill ${premium ? 'premium' : ''}`}>{premium ? 'PREMIUM' : `FREE ${remaining}/5`}</span>
          {!premium && <button className="text-button" onClick={() => setShowPaywall(true)}>アップグレード</button>}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">DROP · LINK · CASCADE</p>
            <h1>落として、つないで、<span>連鎖を起こせ。</span></h1>
            <p className="hero-lead">同じエネルギーを3個以上つなぐと進化。落下と連鎖を読み切る、1プレイ約3分のオリジナル数字パズル。</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={startRound}>{phase === 'playing' ? '新しいラウンド' : '無料でプレイ'}</button>
              <button className="secondary-button" onClick={() => document.getElementById('rules')?.scrollIntoView({ behavior: 'smooth' })}>遊び方</button>
            </div>
            <div className="trust-row"><span>✓ 登録不要</span><span>✓ 1日5回無料</span><span>✓ スマホ対応</span></div>
          </div>
          <div className="hero-card">
            <div className="mini-board" aria-hidden="true">
              {[1, 2, 1, 3, 2, 4, 1, 3, 5, 2, 4, 6].map((value, index) => <span key={index} className={`tile tile-${value}`}>{tileLabels[value]}</span>)}
            </div>
            <div className="pulse-ring" />
            <p>CHAIN REACTION</p><strong>× 5</strong>
          </div>
        </section>

        <section className={`game-layout ${phase === 'intro' ? 'game-muted' : ''}`}>
          <div className="game-panel">
            <div className="score-strip">
              <div><span>SCORE</span><strong>{game.score.toLocaleString()}</strong></div>
              <div><span>BEST</span><strong>{best.toLocaleString()}</strong></div>
              <div><span>MOVES</span><strong>{game.movesLeft}</strong></div>
              <div><span>CHAIN</span><strong>×{game.combo}</strong></div>
            </div>
            <div className="drop-controls" aria-label="drop controls">
              {Array.from({ length: COLS }, (_, column) => (
                <button key={column} onClick={() => handleDrop(column)} disabled={phase !== 'playing' || game.gameOver} aria-label={`列${column + 1}へ落とす`}>
                  <span>↓</span><small>{column + 1}</small>
                </button>
              ))}
            </div>
            <div className="board" role="grid" aria-label="Cascade Circuit game board">
              {game.board.flatMap((row, rowIndex) => row.map((cell, colIndex) => (
                <div className="board-cell" role="gridcell" key={`${rowIndex}-${colIndex}`}>
                  {cell !== null && <div className={`orb tile-${Math.min(cell, 9)}`}><span>{tileLabels[cell] ?? '✺'}</span><small>Lv.{cell}</small></div>}
                </div>
              )))}
            </div>
            <div className="game-message"><span className="live-dot" />{game.lastMessage}</div>
            {phase === 'intro' && <div className="board-overlay"><strong>READY?</strong><button className="primary-button" onClick={startRound}>ラウンド開始</button></div>}
            {phase === 'over' && (
              <div className="board-overlay result-card">
                <p>ROUND COMPLETE</p><strong>{game.score.toLocaleString()}</strong><span>最大 Lv.{game.maxTile}</span>
                <div><button className="primary-button" onClick={startRound}>もう一度</button><button className="secondary-button" onClick={shareScore}>共有</button></div>
              </div>
            )}
          </div>

          <aside className="side-panel">
            <div className="mission-card">
              <p className="eyebrow">TODAY'S MISSION</p><h2>Lv.8のコアを作る</h2>
              <div className="progress"><span style={{ width: `${missionProgress}%` }} /></div>
              <div className="mission-meta"><span>現在 Lv.{game.maxTile}</span><strong>{missionProgress}%</strong></div>
            </div>
            <div className="rules-card" id="rules">
              <h2>3ステップで遊べる</h2>
              <ol><li><b>1</b><span>列を選んで球を落とす</span></li><li><b>2</b><span>同じLv.を3個以上つなぐ</span></li><li><b>3</b><span>連鎖倍率でスコアを伸ばす</span></li></ol>
              <p>キーボードの <kbd>1</kbd>〜<kbd>6</kbd> でも操作できます。</p>
            </div>
            {!premium && <div className="premium-card"><span>CASCADE+ PREMIUM</span><h2>もっと深く、もっと自由に。</h2><ul><li>無制限プレイ</li><li>詳細な自己ベスト統計</li><li>限定カラーテーマ</li><li>今後の新モードを先行解放</li></ul><button className="premium-button" onClick={() => setShowPaywall(true)}>Premiumを見る</button></div>}
          </aside>
        </section>

        <section className="feature-grid">
          <article><span>01</span><h3>短いのに奥深い</h3><p>1手はワンタップ。連鎖の仕込みは何手先までも考えられます。</p></article>
          <article><span>02</span><h3>毎日のミッション</h3><p>日付から生成した共通シードで、同じ条件のスコアに挑戦できます。</p></article>
          <article><span>03</span><h3>フェアな課金</h3><p>ゲームの面白さを5回試してから、無制限プランを選べます。</p></article>
        </section>
      </main>

      <footer><span>© 2026 Cascade Circuit</span><nav><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用規約</a><a href="/commercial.html">特商法表記</a></nav></footer>

      {showPaywall && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPaywall(false)}>
          <section className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPaywall(false)} aria-label="閉じる">×</button>
            <p className="eyebrow">CASCADE+ PREMIUM</p><h2 id="paywall-title">連鎖を止めない。</h2><p>無料プレイで手応えを確かめたら、好きなだけハイスコアを狙えます。</p>
            <div className="plan-grid">
              <button onClick={() => checkout('monthly')} disabled={checkoutBusy}><span>月額</span><strong>¥480<small>/月</small></strong><em>気軽にスタート</em></button>
              <button className="recommended" onClick={() => checkout('yearly')} disabled={checkoutBusy}><i>おすすめ</i><span>年額</span><strong>¥3,800<small>/年</small></strong><em>約2か月分お得</em></button>
            </div>
            <ul className="paywall-benefits"><li>✓ 無制限プレイ</li><li>✓ 広告なし</li><li>✓ プレミアムテーマ</li><li>✓ 新モード先行アクセス</li></ul>
            <p className="payment-note">Stripeの安全な決済画面へ移動します。クレジットカード、対応環境ではApple Pay / Google Payを利用できます。</p>
          </section>
        </div>
      )}
      {notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
