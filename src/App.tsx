import { useEffect, useMemo, useState } from 'react';
import { beginCheckout, fetchEntitlement, openBillingPortal, verifyCheckout } from './api';
import {
  COLS,
  createGame,
  dropInColumn,
  findRecommendedColumn,
  getLandingRow,
  peekNextTile,
  type GameState,
} from './game/engine';
import { consumeFreePlay, readBestScore, remainingFreePlays, saveBestScore } from './game/storage';
import './styles.css';

type Feedback = 'none' | 'drop' | 'merge';

const TUTORIAL_KEY = 'cascade-circuit:first-merge-seen';
const tileLabels: Record<number, string> = {
  1: '●', 2: '◆', 3: '★', 4: '✦', 5: '⬢', 6: '✹', 7: '◈', 8: '✺', 9: '✸',
};

export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [premium, setPremium] = useState(false);
  const [remaining, setRemaining] = useState(() => remainingFreePlays());
  const [best, setBest] = useState(() => readBestScore());
  const [roundStarted, setRoundStarted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState('');
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [feedbackSerial, setFeedbackSerial] = useState(0);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [tutorialDone, setTutorialDone] = useState(() => localStorage.getItem(TUTORIAL_KEY) === '1');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('checkout') === 'success' && sessionId) {
      verifyCheckout(sessionId)
        .then((result) => {
          setPremium(result.premium);
          setNotice(result.premium ? 'Premiumが有効になりました' : '購入確認が完了していません');
        })
        .catch((error: Error) => setNotice(error.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    } else {
      fetchEntitlement().then((result) => setPremium(result.premium));
    }
  }, []);

  const nextTile = peekNextTile(game.seed);
  const recommendedColumn = findRecommendedColumn(game);
  const highlightedColumn = selectedColumn ?? recommendedColumn;
  const landingRow = highlightedColumn >= 0 ? getLandingRow(game.board, highlightedColumn) : -1;
  const missionProgress = useMemo(() => Math.min(100, Math.round((game.maxTile / 8) * 100)), [game.maxTile]);

  function resetRound() {
    setGame(createGame());
    setRoundStarted(false);
    setFeedback('none');
    setSelectedColumn(null);
  }

  function handleColumnTap(column: number) {
    if (game.gameOver) return;
    if (!roundStarted && !premium && remaining <= 0) {
      setShowPaywall(true);
      return;
    }

    if (!roundStarted) {
      if (!premium) setRemaining(consumeFreePlay());
      setRoundStarted(true);
    }

    const result = dropInColumn(game, column);
    setGame(result.state);
    setSelectedColumn(column);
    setFeedbackSerial((value) => value + 1);
    setFeedback(result.state.lastGain > 0 ? 'merge' : 'drop');

    window.setTimeout(() => {
      setFeedback('none');
      setSelectedColumn(null);
    }, result.state.lastGain > 0 ? 1100 : 650);

    if (result.state.lastGain > 0 && !tutorialDone) {
      localStorage.setItem(TUTORIAL_KEY, '1');
      setTutorialDone(true);
    }

    if (result.state.gameOver) {
      setBest(saveBestScore(result.state.score));
    }
  }

  async function checkout(plan: 'monthly' | 'yearly') {
    try {
      await beginCheckout(plan);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '決済を開始できませんでした');
    }
  }

  async function manageSubscription() {
    try {
      await openBillingPortal();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '契約管理画面を開けませんでした');
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
          <button className="help-button" onClick={() => setShowHelp(true)}>遊び方</button>
          <span className={`plan-pill ${premium ? 'premium' : ''}`}>{premium ? 'PREMIUM' : `無料 ${remaining}/5`}</span>
          {premium
            ? <button className="text-button" onClick={manageSubscription}>契約管理</button>
            : <button className="text-button" onClick={() => setShowPaywall(true)}>Premium</button>}
        </div>
      </header>

      <main className="main-content">
        <section className="simple-intro">
          <p className="eyebrow">遊び方はひとつだけ</p>
          <h1>同じ色を<span>3つ</span>にする。</h1>
          <div className="rule-strip" aria-label="ゲームルール">
            <div><b>1</b><span>列をタップ</span></div>
            <i>→</i>
            <div><b>2</b><span>球が落ちる</span></div>
            <i>→</i>
            <div><b>3</b><span>同じ色3つで合体</span></div>
          </div>
        </section>

        <section className="play-area">
          <div className="game-card">
            <div className="next-banner">
              <span>次に落ちる球</span>
              <div className={`next-orb tile-${nextTile}`}>{tileLabels[nextTile]}</div>
              <strong>この色を、同じ色の近くへ</strong>
            </div>

            <div className="score-row">
              <div><span>スコア</span><strong>{game.score.toLocaleString()}</strong></div>
              <div><span>ベスト</span><strong>{best.toLocaleString()}</strong></div>
              <div><span>残り</span><strong>{game.movesLeft}手</strong></div>
            </div>

            <div className="board-caption">
              <strong>{!tutorialDone ? '最初は、点滅している列をタップ' : '置きたい列をタップ'}</strong>
              <span>列全体がボタンです</span>
            </div>

            <div className={`board ${feedback === 'merge' ? 'is-merging' : ''}`} key={`board-${feedbackSerial}`}>
              {Array.from({ length: COLS }, (_, column) => {
                const columnLandingRow = getLandingRow(game.board, column);
                const isRecommended = column === recommendedColumn;
                const isHighlighted = column === highlightedColumn;
                return (
                  <button
                    className={`board-column ${isRecommended ? 'recommended' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    key={column}
                    onClick={() => handleColumnTap(column)}
                    onMouseEnter={() => setSelectedColumn(column)}
                    onMouseLeave={() => setSelectedColumn(null)}
                    onFocus={() => setSelectedColumn(column)}
                    onBlur={() => setSelectedColumn(null)}
                    disabled={game.gameOver || columnLandingRow < 0}
                    aria-label={`左から${column + 1}列目へ落とす`}
                  >
                    {isRecommended && !tutorialDone && <span className="tap-here">ここをタップ</span>}
                    <span className="column-arrow">↓</span>
                    {game.board.map((row, rowIndex) => {
                      const cell = row[column];
                      const showGhost = isHighlighted && rowIndex === landingRow && cell === null && !game.gameOver;
                      return (
                        <span className="board-cell" key={`${rowIndex}-${column}`}>
                          {cell !== null && (
                            <span className={`orb tile-${Math.min(cell, 9)} ${feedback === 'merge' ? 'reacting' : ''}`}>
                              <b>{tileLabels[cell] ?? '✸'}</b><small>{cell}</small>
                            </span>
                          )}
                          {showGhost && <span className={`ghost-orb tile-${nextTile}`}>{tileLabels[nextTile]}</span>}
                        </span>
                      );
                    })}
                  </button>
                );
              })}

              {feedback === 'merge' && (
                <div className="merge-feedback" aria-live="polite">
                  <div><span className={`mini-orb tile-${nextTile}`}>{tileLabels[nextTile]}</span><b>× 3</b></div>
                  <strong>合体！</strong>
                  <small>3つが1つの大きな球になりました</small>
                  <em>+{game.lastGain}</em>
                </div>
              )}
            </div>

            <div className={`status-message ${feedback === 'merge' ? 'success' : ''}`}>
              <span>{feedback === 'merge' ? '✓' : '●'}</span>
              <strong>{game.lastMessage}</strong>
            </div>

            <div className="action-row">
              <button className="secondary-button" onClick={resetRound}>最初から</button>
              {!premium && <button className="premium-small" onClick={() => setShowPaywall(true)}>無制限で遊ぶ</button>}
            </div>

            {game.gameOver && (
              <div className="game-over">
                <p>ラウンド終了</p>
                <strong>{game.score.toLocaleString()}点</strong>
                <button className="primary-button" onClick={resetRound}>もう一度遊ぶ</button>
              </div>
            )}
          </div>

          <aside className="side-info">
            <section className="example-card">
              <p>こうなれば成功</p>
              <div className="merge-example">
                <span className="tile-1">●</span><span className="tile-1">●</span><span className="tile-1">●</span>
                <b>→</b>
                <span className="tile-2 result">◆</span>
              </div>
              <strong>同じ色3つ → ひとつ上の球</strong>
            </section>

            <section className="goal-card">
              <span>今日の目標</span>
              <strong>レベル8の球を作る</strong>
              <div className="progress"><i style={{ width: `${missionProgress}%` }} /></div>
              <small>現在 レベル{game.maxTile}</small>
            </section>

            <section className="plain-help">
              <h2>覚えること</h2>
              <p><b>斜めはつながりません。</b><br />上下か左右で、同じ色を3つ以上にします。</p>
              <button onClick={() => setShowHelp(true)}>図で確認する</button>
            </section>
          </aside>
        </section>
      </main>

      <footer>
        <span>© 2026 Cascade Circuit</span>
        <nav><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用規約</a><a href="/commercial.html">特商法表記</a></nav>
      </footer>

      {showHelp && (
        <div className="modal-backdrop" onMouseDown={() => setShowHelp(false)}>
          <section className="help-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHelp(false)}>×</button>
            <p className="eyebrow">遊び方</p>
            <h2>列をタップして、同じ色を3つにします。</h2>
            <div className="help-visual">
              <article><b>1</b><span className="hand">☝</span><strong>列をタップ</strong></article>
              <i>→</i>
              <article><b>2</b><span className="falling tile-1">●</span><strong>球が落ちる</strong></article>
              <i>→</i>
              <article><b>3</b><span className="triple"><i className="tile-1">●</i><i className="tile-1">●</i><i className="tile-1">●</i></span><strong>3つで合体</strong></article>
            </div>
            <div className="help-note"><b>重要:</b> 同じ色は上下か左右でつなぎます。斜めは数えません。</div>
            <button className="primary-button" onClick={() => setShowHelp(false)}>盤面でやってみる</button>
          </section>
        </div>
      )}

      {showPaywall && (
        <div className="modal-backdrop" onMouseDown={() => setShowPaywall(false)}>
          <section className="paywall" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPaywall(false)}>×</button>
            <p className="eyebrow">CASCADE+ PREMIUM</p>
            <h2>無制限で遊ぶ</h2>
            <p>無料で5ラウンド試した後も、好きなだけ続けられます。</p>
            <div className="plan-grid">
              <button onClick={() => checkout('monthly')}><span>月額</span><strong>¥480<small>/月</small></strong></button>
              <button className="recommended-plan" onClick={() => checkout('yearly')}><i>おすすめ</i><span>年額</span><strong>¥3,800<small>/年</small></strong></button>
            </div>
            <p className="payment-note">Stripeの決済画面へ移動します。カード、対応環境ではApple Pay / Google Payを利用できます。</p>
          </section>
        </div>
      )}

      {notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}
    </div>
  );
}
