import { useEffect, useMemo, useState } from 'react';
import { beginCheckout, fetchEntitlement, openBillingPortal, verifyCheckout } from './api';
import { COLS, createGame, dropInColumn, peekNextTile, type GameState } from './game/engine';
import { consumeFreePlay, readBestScore, remainingFreePlays, saveBestScore } from './game/storage';
import './styles.css';

type Phase = 'intro' | 'playing' | 'over';
interface MoveFx { column: number; serial: number; gain: number; chains: number; }

const GUIDE_KEY = 'cascade-circuit:guide-seen';
const tileLabels: Record<number, string> = {
  1: '⚡', 2: '✦', 3: '◆', 4: '✹', 5: '⬢', 6: '✺', 7: '◈', 8: '✷', 9: '✸',
};

export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [phase, setPhase] = useState<Phase>('intro');
  const [premium, setPremium] = useState(false);
  const [remaining, setRemaining] = useState(() => remainingFreePlays());
  const [best, setBest] = useState(() => readBestScore());
  const [showPaywall, setShowPaywall] = useState(false);
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem(GUIDE_KEY) !== '1');
  const [notice, setNotice] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [moveFx, setMoveFx] = useState<MoveFx>({ column: -1, serial: 0, gain: 0, chains: 0 });

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
      if (phase !== 'playing' || showGuide) return;
      const column = Number(event.key) - 1;
      if (column >= 0 && column < COLS) handleDrop(column);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const missionProgress = useMemo(() => Math.min(100, Math.round((game.maxTile / 8) * 100)), [game.maxTile]);
  const nextTile = peekNextTile(game.seed);

  function dismissGuide(start = false) {
    localStorage.setItem(GUIDE_KEY, '1');
    setShowGuide(false);
    if (start) startRound();
  }

  function startRound() {
    if (!premium && remaining <= 0) {
      setShowPaywall(true);
      return;
    }
    if (!premium) setRemaining(consumeFreePlay());
    setGame(createGame());
    setMoveFx({ column: -1, serial: 0, gain: 0, chains: 0 });
    setPhase('playing');
    setNotice('');
  }

  function handleDrop(column: number) {
    const result = dropInColumn(game, column);
    if (!result.accepted) {
      setGame(result.state);
      setMoveFx((current) => ({ ...current, column, serial: current.serial + 1, gain: 0, chains: 0 }));
      return;
    }

    setGame(result.state);
    setMoveFx((current) => ({
      column,
      serial: current.serial + 1,
      gain: result.state.lastGain,
      chains: result.state.combo,
    }));

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

  async function manageSubscription() {
    setNotice('');
    try {
      await openBillingPortal();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '契約管理画面を開けませんでした');
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
          <button className="help-button" onClick={() => setShowGuide(true)} aria-label="遊び方を表示">?</button>
          <span className={`plan-pill ${premium ? 'premium' : ''}`}>{premium ? 'PREMIUM' : `FREE ${remaining}/5`}</span>
          {premium
            ? <button className="text-button" onClick={manageSubscription}>契約管理</button>
            : <button className="text-button" onClick={() => setShowPaywall(true)}>アップグレード</button>}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">DROP · MATCH 3 · CASCADE</p>
            <h1>落とす。3つつなぐ。<span>連鎖で進化。</span></h1>
            <p className="hero-lead">次のコアを6本の列から1つ選んで落とします。同じ色が上下左右に3個以上つながると、ひとつ上のコアへ合体します。</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={startRound}>{phase === 'playing' ? '新しいラウンド' : '無料でプレイ'}</button>
              <button className="secondary-button" onClick={() => setShowGuide(true)}>動きで見る遊び方</button>
            </div>
            <div className="trust-row"><span>① 列を選ぶ</span><span>② 同色を3つ</span><span>③ 連鎖で高得点</span></div>
          </div>
          <div className="hero-card">
            <div className="demo-drop" aria-hidden="true"><span className="demo-orb tile-1">⚡</span><i /></div>
            <div className="demo-match" aria-hidden="true"><span className="tile tile-1">⚡</span><span className="tile tile-1">⚡</span><span className="tile tile-1">⚡</span></div>
            <div className="demo-result tile-2" aria-hidden="true">✦</div>
            <p>3 MATCH → LEVEL UP</p><strong>+ CHAIN</strong>
          </div>
        </section>

        <section className={`game-layout ${phase === 'intro' ? 'game-muted' : ''}`}>
          <div className={`game-panel ${moveFx.gain > 0 ? 'has-cascade' : ''}`} key={`panel-${moveFx.serial}`}>
            <div className="game-explainer">
              <div className="next-piece"><span>NEXT</span><div className={`preview-orb tile-${nextTile}`}>{tileLabels[nextTile]}</div><strong>このコアを落とす</strong></div>
              <div className="match-rule"><span className="rule-orbs"><i className="tile-1">⚡</i><i className="tile-1">⚡</i><i className="tile-1">⚡</i></span><strong>同じ色を3個以上</strong><small>斜めではなく、上下左右につなげます</small></div>
            </div>

            <div className="score-strip">
              <div><span>SCORE</span><strong>{game.score.toLocaleString()}</strong></div>
              <div><span>BEST</span><strong>{best.toLocaleString()}</strong></div>
              <div><span>残り手数</span><strong>{game.movesLeft}</strong></div>
              <div><span>連鎖</span><strong>×{game.combo}</strong></div>
            </div>

            <div className="drop-controls" aria-label="落とす列を選択">
              {Array.from({ length: COLS }, (_, column) => (
                <button
                  key={column}
                  onClick={() => handleDrop(column)}
                  onMouseEnter={() => setHoveredColumn(column)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onFocus={() => setHoveredColumn(column)}
                  onBlur={() => setHoveredColumn(null)}
                  disabled={phase !== 'playing' || game.gameOver}
                  aria-label={`列${column + 1}へ次のコアを落とす`}
                >
                  <span className={`control-orb tile-${nextTile}`}>{tileLabels[nextTile]}</span>
                  <b>ここへ落とす</b>
                  <small>{column + 1}</small>
                </button>
              ))}
            </div>

            <div className={`board ${moveFx.gain > 0 ? 'board-cascade' : ''}`} role="grid" aria-label="Cascade Circuit game board">
              {(hoveredColumn !== null || moveFx.column >= 0) && (
                <div
                  className={`drop-beam ${hoveredColumn !== null ? 'is-preview' : 'is-drop'}`}
                  style={{ left: `calc(${hoveredColumn ?? moveFx.column} * (100% / 6) + (100% / 12))` }}
                  aria-hidden="true"
                />
              )}
              {moveFx.gain > 0 && <div className="score-pop" aria-live="polite">+{moveFx.gain}<small>{moveFx.chains} CHAIN</small></div>}
              {game.board.flatMap((row, rowIndex) => row.map((cell, colIndex) => (
                <div className={`board-cell ${hoveredColumn === colIndex ? 'column-preview' : ''}`} role="gridcell" key={`${rowIndex}-${colIndex}`}>
                  {cell !== null && (
                    <div
                      key={`${rowIndex}-${colIndex}-${cell}-${colIndex === moveFx.column ? moveFx.serial : 0}`}
                      className={`orb tile-${Math.min(cell, 9)} ${colIndex === moveFx.column ? 'orb-dropped' : ''} ${moveFx.gain > 0 ? 'orb-reacting' : ''}`}
                    >
                      <span>{tileLabels[cell] ?? '✺'}</span><small>Lv.{cell}</small>
                    </div>
                  )}
                </div>
              )))}
            </div>

            <div className="game-message"><span className="live-dot" />{game.lastMessage}</div>
            {phase === 'intro' && <div className="board-overlay"><span className="overlay-hint">上の6つのボタンから列を選びます</span><strong>READY?</strong><button className="primary-button" onClick={startRound}>ラウンド開始</button></div>}
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
              <h2>迷ったら、この順番</h2>
              <ol><li><b>1</b><span><strong>NEXT</strong> の色を確認</span></li><li><b>2</b><span>同じ色の近くへ落とす</span></li><li><b>3</b><span>3個つながる場所を作る</span></li></ol>
              <button className="guide-link" onClick={() => setShowGuide(true)}>アニメーションで確認する →</button>
              <p>キーボードの <kbd>1</kbd>〜<kbd>6</kbd> でも操作できます。</p>
            </div>
            {!premium && <div className="premium-card"><span>CASCADE+ PREMIUM</span><h2>もっと深く、もっと自由に。</h2><ul><li>無制限プレイ</li><li>詳細な自己ベスト統計</li><li>限定カラーテーマ</li><li>今後の新モードを先行解放</li></ul><button className="premium-button" onClick={() => setShowPaywall(true)}>Premiumを見る</button></div>}
          </aside>
        </section>

        <section className="feature-grid">
          <article><span>01</span><h3>落下が見える</h3><p>選んだ列が光り、コアが上から落ちるため、どこへ置いたかを追えます。</p></article>
          <article><span>02</span><h3>合体が伝わる</h3><p>3個以上がつながると盤面が発光し、得点と連鎖数が中央へ表示されます。</p></article>
          <article><span>03</span><h3>次の手が明確</h3><p>NEXT表示と各列のプレビューで、置く前に狙いを考えられます。</p></article>
        </section>
      </main>

      <footer><span>© 2026 Cascade Circuit</span><nav><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用規約</a><a href="/commercial.html">特商法表記</a></nav></footer>

      {showGuide && (
        <div className="modal-backdrop guide-backdrop" role="presentation" onMouseDown={() => dismissGuide(false)}>
          <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => dismissGuide(false)} aria-label="閉じる">×</button>
            <p className="eyebrow">20秒でわかる遊び方</p>
            <h2 id="guide-title">同じ色を3つつなぐだけ。</h2>
            <div className="guide-steps">
              <article><span className="step-number">1</span><div className="guide-animation drop-animation"><i className="tile-1">⚡</i><b>↓</b><em /></div><h3>列を選んで落とす</h3><p>6本のうち、置きたい列をタップします。</p></article>
              <article><span className="step-number">2</span><div className="guide-animation match-animation"><i className="tile-1">⚡</i><i className="tile-1">⚡</i><i className="tile-1">⚡</i></div><h3>同じ色を3個つなぐ</h3><p>上下左右につながれば合体します。</p></article>
              <article><span className="step-number">3</span><div className="guide-animation evolve-animation"><i className="tile-1">⚡</i><b>×3</b><strong>→</strong><i className="tile-2">✦</i></div><h3>1段階進化する</h3><p>落下後にまた3個できると連鎖です。</p></article>
            </div>
            <div className="guide-summary"><span className="tile tile-1">⚡</span><span>+</span><span className="tile tile-1">⚡</span><span>+</span><span className="tile tile-1">⚡</span><strong>→</strong><span className="tile tile-2">✦</span></div>
            <button className="primary-button guide-start" onClick={() => dismissGuide(true)}>理解した。無料で始める</button>
          </section>
        </div>
      )}

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
