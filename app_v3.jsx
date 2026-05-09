/* eslint-disable */
// ═══════════════════════════════════════════════════════════════
//  우리 마을 경제 매니저  v3  —  Firebase 실시간 연동
//  학생 태블릿 입력 → Firebase → 교사 전자칠판 자동 갱신
// ═══════════════════════════════════════════════════════════════

// ── Firebase SDK (CDN에서 로드, index.html에 script 태그 필요) ──
// import는 모듈 방식 대신 window.firebase 전역 객체 사용
// → 아래 initFirebase()에서 처리

const { useState, useEffect, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────
//  🔥 Firebase 설정 — 선생님 config로 교체하세요
// ─────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRi8c6XhwWqyeZFN7EyFVB5WDn3PG2tPM",
  authDomain: "village-econmy-manager.firebaseapp.com",
  databaseURL: "https://village-econmy-manager-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "village-econmy-manager",
  storageBucket: "village-econmy-manager.firebasestorage.app",
  messagingSenderId: "990780268455",
  appId: "1:990780268455:web:4bee541f1548ca8e29a082",
  measurementId: "G-0TBMN1CV9T"
};

// DB 경로
const DB_PATH = 'village_economy_v1';

// ─────────────────────────────────────────────────────────────
//  게임 데이터 상수
// ─────────────────────────────────────────────────────────────
const FACILITIES = {
  farm:    { icon: '🌾', name: '논',    cost: 3, prod: { rice: 3 },        happy: 0 },
  factory: { icon: '🏭', name: '공장',   cost: 5, prod: { product: 2 },     happy: 0 },
  power:   { icon: '⚡', name: '발전소', cost: 6, prod: { electricity: 4 }, happy: 0 },
  hospital:{ icon: '🏥', name: '병원',   cost: 5, prod: { medical: 2 },     happy: 5 },
  school:  { icon: '🏫', name: '학교',   cost: 4, prod: {},                 happy: 3 },
  tourist: { icon: '🎭', name: '관광지', cost: 4, prod: { culture: 2 },     happy: 5 },
  market:  { icon: '🛒', name: '시장',   cost: 3, prod: {},                 happy: 2 },
};

const RESOURCES = {
  rice:        { icon: '🌾', name: '쌀',   desc: '매 라운드 2소비' },
  electricity: { icon: '⚡', name: '전기', desc: '공장 가동에 필수' },
  medical:     { icon: '🏥', name: '의료', desc: '행복 회복(+5)' },
  culture:     { icon: '🎭', name: '문화', desc: '행복 상승(+3)' },
  product:     { icon: '🏭', name: '제품', desc: '수출시 코인(+2)' },
};

const ROUND_EVENTS = {
  3: { name: '🌧️ 가뭄 발생', desc: '이번 라운드 쌀 생산량이 30% 감소합니다. 쌀이 부족해지지 않도록 주의하세요!' },
  4: { name: '🦠 전염병 경보', desc: '마을의 기본 행복지수가 -10 감소합니다. 병원이 있으면 -5로 경감! 의료 자원으로 치료하세요!' },
  5: { name: '🤝 기술 교류 제안', desc: '학교가 있는 마을은 행복 +5 보너스! 이번 라운드 교류를 1회 무료로 할 수 있어요.' },
  6: { name: '🎭 문화 축제 개최', desc: '관광지가 있는 마을은 행복 +5, 코인 +3 보너스!' },
  7: { name: '🏅 품질 인증 획득', desc: '논이 2개 이상인 마을은 코인 +5 보너스! 농업 마을의 역습!' },
  8: { name: '🌊 홍수 피해', desc: '정산 시 쌀이 2개 추가로 유실됩니다. 쌀이 충분한 마을과 교류하면 위기를 넘길 수 있어요!' },
};

const ROUND_QUESTIONS = {
  1: '15코인이 주어진다면 어떤 기준으로 건물을 고를 거야? 왜 그 기준이 중요할까?',
  2: '계획과 실제가 달라진 게 있어? 그 선택이 더 합리적이었을까?',
  3: '가뭄이 왔을 때 우리 마을 쌀이 부족했다면, 어떻게 해결할 수 있을까?',
  4: '전염병 위기를 교류 없이 해결할 방법이 있어? 왜 교류가 필요할까?',
  5: '어느 마을과 교류하는 게 가장 합리적인 선택이야? 근거는?',
  6: '교류 후 수치로 뭐가 달라졌어? 물자·기술·문화 교류는 어떻게 달라?',
  7: '교류 횟수와 행복지수 사이에 어떤 관계가 보여? 근거는?',
  8: '교류가 없었다면 우리 마을은 지금 어떻게 됐을까? 데이터로 설명해봐.',
};

const ROUND_LABELS = {
  1: 'R1 · 5차시', 2: 'R2 · 6차시', 3: 'R3 · 7차시',
  4: 'R4 · 8~9차시', 5: 'R5 · 9~10차시', 6: 'R6 · 10~11차시',
  7: 'R7 · 11~12차시', 8: 'R8 · 12~13차시 · 최종',
};

const VILLAGE_THEME = {
  1: { cls: 'vc-1', roof: '🏡', tag: '햇살 마을' },
  2: { cls: 'vc-2', roof: '🌳', tag: '숲속 마을' },
  3: { cls: 'vc-3', roof: '🏘️', tag: '바다 마을' },
  4: { cls: 'vc-4', roof: '🏰', tag: '꽃잎 마을' },
};

const EMPTY_BOUGHT      = () => Object.fromEntries(Object.keys(FACILITIES).map(k => [k, 0]));
const EMPTY_TRADE       = () => ({ rice: 0, electricity: 0, medical: 0, product: 0, culture: 0, coins: 0 });
const EMPTY_ROUND_INPUT = () => ({ bought: EMPTY_BOUGHT(), tradeIn: EMPTY_TRADE(), tradeOut: EMPTY_TRADE() });

const INIT_GROUP = (n) => ({
  name: `${n}모둠 마을`,
  coins: 25,
  happyBase: 50,
  resources: { rice: 0, electricity: 0, medical: 0, product: 0, culture: 0 },
  facilities: { farm: 0, factory: 0, power: 0, hospital: 0, school: 0, tourist: 0, market: 0 },
  lastSubmittedRound: 0,
  tradeCount: 0,
});

const INIT_APP = () => ({ round: 1, groups: {} });

function calcHappiness(happyBase, facilities) {
  if (!facilities) return happyBase ?? 50;
  const facHappy = Object.entries(facilities).reduce((sum, [id, cnt]) => {
    if (!FACILITIES[id]) return sum;
    return sum + (FACILITIES[id].happy * cnt);
  }, 0);
  return Math.max(0, Math.min(100, (happyBase ?? 50) + facHappy));
}

// ─────────────────────────────────────────────────────────────
//  Firebase 초기화 훅
// ─────────────────────────────────────────────────────────────
function useFirebase() {
  const [db, setDb] = useState(null);
  const [fbReady, setFbReady] = useState(false);
  const [fbError, setFbError] = useState(null);

  useEffect(() => {
    // Firebase SDK가 CDN으로 로드됐는지 확인
    if (typeof firebase === 'undefined') {
      setFbError('Firebase SDK가 로드되지 않았습니다. index.html을 확인하세요.');
      return;
    }
    try {
      // 이미 초기화됐으면 재사용
      let app;
      if (firebase.apps && firebase.apps.length > 0) {
        app = firebase.apps[0];
      } else {
        app = firebase.initializeApp(FIREBASE_CONFIG);
      }
      const database = firebase.database(app);
      setDb(database);
      setFbReady(true);
    } catch (e) {
      setFbError('Firebase 연결 실패: ' + e.message);
    }
  }, []);

  return { db, fbReady, fbError };
}

// ─────────────────────────────────────────────────────────────
//  실시간 DB 읽기/쓰기 훅
// ─────────────────────────────────────────────────────────────
function useGameState(db, fbReady) {
  const [gameState, setGameState] = useState(INIT_APP());
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!db || !fbReady) return;
    const ref = db.ref(DB_PATH);
    const onValue = ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      } else {
        // 데이터 없으면 초기값 쓰기
        ref.set(INIT_APP());
      }
      setSynced(true);
    }, (err) => {
      console.error('Firebase 읽기 오류:', err);
    });
    return () => ref.off('value', onValue);
  }, [db, fbReady]);

  const saveState = useCallback((newState) => {
    setGameState(newState); // 낙관적 업데이트
    if (db && fbReady) {
      db.ref(DB_PATH).set(newState).catch(err => {
        console.error('Firebase 쓰기 오류:', err);
      });
    }
  }, [db, fbReady]);

  const resetState = useCallback(() => {
    const fresh = INIT_APP();
    setGameState(fresh);
    if (db && fbReady) {
      db.ref(DB_PATH).set(fresh);
    }
  }, [db, fbReady]);

  return { gameState, saveState, resetState, synced };
}

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
function App() {
  const { db, fbReady, fbError } = useFirebase();
  const { gameState, saveState, resetState, synced } = useGameState(db, fbReady);
  const [mode, setMode] = useState('start'); // 'start' | 'student' | 'teacher'
  const [activeGroup, setActiveGroup] = useState(null);

  // Firebase 오류 화면
  if (fbError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF8E7', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center', background: 'white', borderRadius: 24, padding: 36, border: '3px solid #F2C98A', boxShadow: '0 8px 0 #F2C98A' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🔥</div>
          <h2 style={{ fontFamily: 'Jua', color: '#B83C30', margin: '0 0 12px' }}>Firebase 연결 오류</h2>
          <p style={{ fontFamily: 'Gaegu', fontSize: 18, color: '#5A3A22', lineHeight: 1.6, margin: '0 0 24px' }}>{fbError}</p>
          <div style={{ background: '#FFF3D6', borderRadius: 14, padding: 16, textAlign: 'left', fontFamily: 'Gaegu', fontSize: 15, color: '#8A6B4F' }}>
            <b>해결 방법:</b><br />
            1. index.html에 Firebase SDK script 태그가 있는지 확인<br />
            2. databaseURL이 올바른지 확인<br />
            3. Firebase 콘솔에서 Realtime Database가 활성화됐는지 확인
          </div>
        </div>
      </div>
    );
  }

  // 연결 중 화면
  if (!synced) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #C9ECF2 0%, #FFF3D6 60%, #FFE6A8 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 16, animation: 'float-y 1.5s ease-in-out infinite' }}>🏘️</div>
          <div style={{ fontFamily: 'Jua', fontSize: 28, color: '#8E5A2E', marginBottom: 8 }}>마을 연결 중...</div>
          <div style={{ fontFamily: 'Gaegu', fontSize: 18, color: '#8A6B4F' }}>Firebase에 접속하고 있어요 🔥</div>
        </div>
      </div>
    );
  }

  // 화면 라우팅
  if (mode === 'teacher') {
    return <TeacherBoard gameState={gameState} saveState={saveState} resetState={resetState} setMode={setMode} />;
  }
  if (mode === 'student' && activeGroup) {
    return <StudentCalc gameState={gameState} saveState={saveState} setMode={setMode} activeGroup={activeGroup} />;
  }
  return <StartScreen gameState={gameState} saveState={saveState} setMode={setMode} setActiveGroup={setActiveGroup} />;
}

// ─────────────────────────────────────────────────────────────
//  시작 화면
// ─────────────────────────────────────────────────────────────
function StartScreen({ gameState, saveState, setMode, setActiveGroup }) {
  const { round, groups } = gameState;

  const enterGroup = (n) => {
    const newGroups = { ...groups };
    if (!newGroups[n]) {
      newGroups[n] = INIT_GROUP(n);
      saveState({ ...gameState, groups: newGroups });
    }
    setActiveGroup(n);
    setMode('student');
  };

  return (
    <div className="sky-bg" style={{ minHeight: '100vh', padding: '32px 20px 60px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 30, left: '8%', fontSize: 38, animation: 'float-y 4s ease-in-out infinite' }}>🌳</div>
      <div style={{ position: 'absolute', top: 80, right: '10%', fontSize: 32, animation: 'float-y 3.5s ease-in-out infinite' }}>🌷</div>
      <div style={{ position: 'absolute', bottom: 40, left: '12%', fontSize: 36, animation: 'float-y 4.5s ease-in-out infinite' }}>🦋</div>
      <div style={{ position: 'absolute', bottom: 60, right: '8%', fontSize: 34, animation: 'float-y 3s ease-in-out infinite' }}>🐤</div>

      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        {/* Firebase 연결 상태 표시 */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(108,255,177,0.15)', border: '2px solid rgba(108,255,177,0.6)', borderRadius: 999, padding: '4px 14px', fontFamily: 'Jua', fontSize: 13, color: '#2E6B4F', marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F8A2E', display: 'inline-block', boxShadow: '0 0 6px #4F8A2E' }}></span>
          🔥 Firebase 실시간 연결됨
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 999, padding: '6px 16px', fontFamily: 'Jua', fontSize: 14, color: 'var(--wood-deep)', marginBottom: 18, border: '2px solid var(--wood-light)' }}>
          🎮 v3 Firebase · 경제 순환 시스템
        </div>
        <div><span className="pennant">🏘️ 우리 마을 경제 매니저</span></div>
        <p style={{ fontFamily: 'Gaegu', fontSize: 22, color: 'var(--wood-deep)', margin: '28px 0 4px' }}>
          빈 땅에서 시작해, 우리 모둠만의 마을을 키워봐!
        </p>
        <div style={{ marginTop: 6 }}>
          <span className="ribbon">📅 현재 진행 — {ROUND_LABELS[round]}</span>
        </div>

        <div className="plate" style={{ marginTop: 36, padding: '32px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontFamily: 'Jua', fontSize: 26, margin: 0, color: 'var(--ink)' }}>👋 어느 모둠으로 들어갈까?</h2>
            <span className="tag-num" style={{ fontSize: 13, padding: '4px 12px' }}>👨‍🎓 학생 입력기</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 6 }}>
            {[1, 2, 3, 4].map(n => {
              const isDone = groups[n] && groups[n].lastSubmittedRound === round;
              const t = VILLAGE_THEME[n];
              const g = groups[n];
              return (
                <button key={n} onClick={() => !isDone && enterGroup(n)}
                  className={`village-card ${t.cls} ${isDone ? 'done' : ''}`}
                  disabled={isDone} style={{ border: 'none', cursor: isDone ? 'default' : 'pointer' }}>
                  {isDone && <span className="stamp">완료 ✓</span>}
                  <div className="roof">{t.roof}</div>
                  <h3>{n}모둠</h3>
                  <div style={{ fontFamily: 'Gaegu', fontSize: 15, opacity: 0.8, marginTop: -2 }}>{t.tag}</div>
                  {g && (
                    <div className="mini">
                      <span>💰 {g.coins}</span>
                      <span>💚 {calcHappiness(g.happyBase, g.facilities)}</span>
                    </div>
                  )}
                  {!g && <div className="mini"><span>새 마을 시작 →</span></div>}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 28, paddingTop: 22, borderTop: '2px dashed #F2D9A8' }}>
            <button onClick={() => setMode('teacher')} className="btn3d navy" style={{ width: '100%', fontSize: 20 }}>
              📺 선생님 대시보드 (교실 TV용)
            </button>
            <p style={{ fontFamily: 'Gaegu', fontSize: 16, color: 'var(--ink-soft)', margin: '10px 0 0' }}>
              4모둠 현황을 한눈에 — 학생이 입력하면 자동으로 반영됩니다 🔥
            </p>
          </div>
        </div>

        <p style={{ fontFamily: 'Gaegu', fontSize: 16, color: 'var(--ink-soft)', marginTop: 28 }}>
          🌟 자원을 모으고, 시설을 짓고, 이웃 마을과 교류하며 우리 모둠 목표를 달성하자!
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  학생 입력기
// ─────────────────────────────────────────────────────────────
function StudentCalc({ gameState, saveState, setMode, activeGroup }) {
  const gIdx = activeGroup;
  const group = gameState.groups[gIdx];
  const [ri, setRi] = useState(EMPTY_ROUND_INPUT());
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!group) return null;

  const handleUseResource = (type) => {
    const updatedGroup = { ...group };
    if (type === 'medical' && updatedGroup.resources.medical >= 1) {
      updatedGroup.resources.medical -= 1;
      updatedGroup.happyBase = Math.min(100, updatedGroup.happyBase + 5);
    } else if (type === 'culture' && updatedGroup.resources.culture >= 1) {
      updatedGroup.resources.culture -= 1;
      updatedGroup.happyBase = Math.min(100, updatedGroup.happyBase + 3);
    } else if (type === 'product' && updatedGroup.resources.product >= 1) {
      updatedGroup.resources.product -= 1;
      updatedGroup.coins += 2;
    }
    saveState({ ...gameState, groups: { ...gameState.groups, [gIdx]: updatedGroup } });
  };

  // 정산 완료 화면
  if (group.lastSubmittedRound === gameState.round) {
    return (
      <div className="sky-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="plate" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '40px 28px' }}>
          <div style={{ fontSize: 80, marginBottom: 8, animation: 'float-y 2.5s ease-in-out infinite' }}>🎉</div>
          <h2 style={{ fontFamily: 'Jua', fontSize: 30, color: 'var(--leaf-deep)', margin: '0 0 12px' }}>정산 완료!</h2>
          <p style={{ fontFamily: 'Gaegu', fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 8px' }}>
            이 모둠의 <b style={{color:'var(--berry-deep)'}}>{gameState.round}라운드</b> 데이터가<br />
            <b style={{color:'#4F8A2E'}}>선생님 화면에 바로 반영</b>되었습니다! 🔥
          </p>
          {/* Firebase 연동 확인 표시 */}
          <div style={{ background: 'rgba(108,255,177,0.15)', border: '2px solid rgba(108,255,177,0.5)', borderRadius: 14, padding: '10px 16px', margin: '12px 0 24px', fontFamily: 'Gaegu', fontSize: 15, color: '#2E6B4F' }}>
            📺 교사 화면에서 실시간으로 확인할 수 있어요!
          </div>
          <button onClick={() => setMode('start')} className="btn3d green" style={{ width: '100%' }}>
            🏠 메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const buildCost = Object.entries(ri.bought).reduce((s, [id, cnt]) => s + (FACILITIES[id]?.cost || 0) * cnt, 0);
  const coinAfterSettle = (group.coins ?? 15) - buildCost + (ri.tradeIn.coins || 0) - (ri.tradeOut.coins || 0);
  const settleDisabled = coinAfterSettle < 0 || saving;

  const executeApply = async () => {
    setSaving(true);
    let nextCoins = coinAfterSettle;
    let nextResources = { ...group.resources };
    let nextFacilities = { ...group.facilities };
    let nextHappyBase = group.happyBase ?? 50;

    const didTrade = Object.values(ri.tradeIn).some(v => v > 0) || Object.values(ri.tradeOut).some(v => v > 0);
    let nextTradeCount = (group.tradeCount || 0) + (didTrade ? 1 : 0);

    Object.entries(ri.bought).forEach(([id, cnt]) => {
      if (cnt > 0) nextFacilities[id] = (nextFacilities[id] || 0) + cnt;
    });

    Object.entries(ri.tradeIn).forEach(([res, val]) => { if (res !== 'coins') nextResources[res] = (nextResources[res] || 0) + val; });
    Object.entries(ri.tradeOut).forEach(([res, val]) => { if (res !== 'coins') nextResources[res] = (nextResources[res] || 0) - val; });

    if (didTrade && nextFacilities.market > 0) nextCoins += 1;
    nextCoins += 5;

    Object.entries(nextFacilities).forEach(([id, cnt]) => {
      if (cnt <= 0 || id === 'factory' || !FACILITIES[id]?.prod) return;
      Object.entries(FACILITIES[id].prod).forEach(([res, amount]) => {
        let yieldVal = amount * cnt;
        if (gameState.round === 3 && res === 'rice') yieldVal = Math.floor(yieldVal * 0.7);
        nextResources[res] = (nextResources[res] || 0) + yieldVal;
      });
    });

    if (nextFacilities.factory > 0) {
      let runCount = 0;
      for (let i = 0; i < nextFacilities.factory; i++) {
        if (nextResources.electricity >= 1) { nextResources.electricity -= 1; runCount++; }
      }
      nextResources.product = (nextResources.product || 0) + (runCount * 2);
    }

    let riceToEat = 2;
    if (gameState.round === 8) riceToEat += 2;
    nextResources.rice = (nextResources.rice || 0) - riceToEat;
    if (nextResources.rice < 0) { nextHappyBase = Math.max(0, nextHappyBase - 5); nextResources.rice = 0; }

    if (gameState.round === 4) {
      nextHappyBase = Math.max(0, nextHappyBase - (nextFacilities.hospital > 0 ? 5 : 10));
    }
    if (gameState.round === 5 && nextFacilities.school > 0) nextHappyBase += 5;
    if (gameState.round === 6 && nextFacilities.tourist > 0) { nextHappyBase += 5; nextCoins += 3; }
    if (gameState.round === 7 && nextFacilities.farm >= 2) nextCoins += 5;

    const updatedGroup = {
      ...group,
      coins: nextCoins,
      happyBase: nextHappyBase,
      resources: nextResources,
      facilities: nextFacilities,
      lastSubmittedRound: gameState.round,
      tradeCount: nextTradeCount
    };

    // Firebase에 저장 (교사 화면 자동 갱신)
    saveState({
      ...gameState,
      groups: { ...gameState.groups, [gIdx]: updatedGroup }
    });
    setSaving(false);
    setShowConfirm(false);
  };

  const happiness = calcHappiness(group.happyBase, group.facilities);
  const theme = VILLAGE_THEME[gIdx];

  return (
    <div className="sky-bg" style={{ minHeight: '100vh', paddingBottom: 120 }}>
      {/* HUD */}
      <div className="hud">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 720, margin: '0 auto', padding: '14px 18px', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setMode('start')} className="pill">← 메인</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{theme.roof}</span>
            <span style={{ fontFamily: 'Jua', fontSize: 22, color: 'var(--ink)' }}>{group.name}</span>
            <span className="ribbon" style={{ fontSize: 13, padding: '4px 14px' }}>R{gameState.round}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="coin-pill">💰 {group.coins}</span>
            <span className="heart-pill">💚 {happiness}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 18px' }}>
        {ROUND_EVENTS[gameState.round] && (
          <div className="bubble banner-event" style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Jua', fontSize: 20, color: '#A6650F', marginBottom: 4 }}>
              📢 라운드 이벤트 — {ROUND_EVENTS[gameState.round].name}
            </div>
            <div style={{ fontFamily: 'Gaegu', fontSize: 17, color: '#7A4D0C', lineHeight: 1.4 }}>
              {ROUND_EVENTS[gameState.round].desc}
            </div>
          </div>
        )}

        <div className="bubble banner-econ" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Jua', fontSize: 16, color: '#5A2D8A' }}>
            🏛️ 기본 경제 — 정산 시 <b style={{color:'var(--leaf-deep)'}}>+5 코인</b> 들어오고, <b style={{color:'var(--berry-deep)'}}>쌀 2개</b> 소비!
          </div>
        </div>

        <div className="bubble banner-info-blue" style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Gaegu', fontSize: 17, color: 'var(--in-ink)' }}>
            💡 <b>꿀팁!</b> 코인이 부족할 땐 우리 마을의 <b>남는 자원을 이웃 마을에 팔아서</b> 코인을 벌어보세요!
          </div>
        </div>

        {/* 자원 즉시 사용하기 */}
        <SectionTitle icon="✨" text="자원 즉시 사용하기" sub="(수요 창출)" accent="#4F8A2E" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          <UseResourceCard available={(group.resources.medical || 0) >= 1}
            theme={{ '--c-bg-1':'#FFFFFF','--c-bg-2':'#DBEEFF','--c-border':'#7DB7E8','--c-shadow':'#7DB7E8','--c-ink':'#1A4F7A' }}
            emoji="🏥" label="의료 쓰기" effect="행복 +5" stock={group.resources.medical || 0}
            onClick={() => handleUseResource('medical')} />
          <UseResourceCard available={(group.resources.culture || 0) >= 1}
            theme={{ '--c-bg-1':'#FFFFFF','--c-bg-2':'#F1E2FA','--c-border':'#C8A0E6','--c-shadow':'#C8A0E6','--c-ink':'#5A2D8A' }}
            emoji="🎭" label="문화 쓰기" effect="행복 +3" stock={group.resources.culture || 0}
            onClick={() => handleUseResource('culture')} />
          <UseResourceCard available={(group.resources.product || 0) >= 1}
            theme={{ '--c-bg-1':'#FFFFFF','--c-bg-2':'#FFF1B5','--c-border':'#F2C260','--c-shadow':'#F2C260','--c-ink':'#7A4D0C' }}
            emoji="🏭" label="제품 수출" effect="코인 +2" stock={group.resources.product || 0}
            onClick={() => handleUseResource('product')} />
        </div>

        {/* 보유 현황 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
          <div className="plate-soft" style={{ padding: 16 }}>
            <div style={{ fontFamily: 'Jua', fontSize: 16, color: 'var(--wood-deep)', marginBottom: 10 }}>📦 보유 자원</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(RESOURCES).map(([id, r]) => (
                <div key={id} className="chip" style={{ padding: '6px 10px' }}>
                  <span className="ic">{r.icon}</span>
                  <span style={{ fontSize: 13 }}>{r.name}</span>
                  <span className="num">{group.resources[id] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="plate-soft" style={{ padding: 16 }}>
            <div style={{ fontFamily: 'Jua', fontSize: 16, color: 'var(--wood-deep)', marginBottom: 10 }}>🏗️ 보유 시설</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(FACILITIES).map(([id, f]) => (
                <div key={id} className="chip" style={{ padding: '6px 10px' }}>
                  <span className="ic">{f.icon}</span>
                  <span style={{ fontSize: 13 }}>{f.name}</span>
                  <span className="num">{group.facilities[id] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 시설 건설 */}
        <SectionTitle icon="🧱" text="시설 건설" sub={`남은 코인: ${coinAfterSettle}`} accent="var(--wood-deep)" />
        <div className="plate-soft" style={{ padding: 16, marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(FACILITIES).map(([id, f]) => (
              <div key={id} className="fac-row">
                <div className="ic">{f.icon}</div>
                <div>
                  <div className="nm">{f.name}</div>
                  <div className="cost">💰 {f.cost}</div>
                </div>
                <div className="ctr">
                  <button className="qbtn minus" disabled={ri.bought[id] === 0}
                    onClick={() => setRi(r => ({ ...r, bought: { ...r.bought, [id]: Math.max(0, r.bought[id] - 1) } }))}>−</button>
                  <span className="num">{ri.bought[id]}</span>
                  <button className="qbtn plus"
                    onClick={() => setRi(r => ({ ...r, bought: { ...r.bought, [id]: r.bought[id] + 1 } }))}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF8E0', borderRadius: 14, border: '2px dashed #F2C260', fontFamily: 'Gaegu', fontSize: 16, color: '#7A4D0C', textAlign: 'center' }}>
            🔨 건설비 합계 : <b>{buildCost}</b> 코인
          </div>
        </div>

        {/* 교류 협상 결과 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionTitle icon="🤝" text="교류 협상 결과" accent="var(--ocean-deep)" inline />
          <span className="tag-num">현재 교류 횟수: {group.tradeCount || 0}회</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
          <div className="trade-panel in">
            <div style={{ fontFamily: 'Jua', fontSize: 16, color: 'var(--in-ink)', marginBottom: 10, display:'flex', alignItems:'center', gap: 6 }}>
              <span style={{ background: 'var(--in-ink)', color: 'white', borderRadius: 999, width: 22, height: 22, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize: 14 }}>+</span>
              받은 자원 / 코인
            </div>
            {Object.keys(RESOURCES).map(id => (
              <div key={id} className="trade-row">
                <span className="ic">{RESOURCES[id].icon}</span>
                <span className="nm">{RESOURCES[id].name}</span>
                <input className="trade-input" type="number" min="0" value={ri.tradeIn[id]}
                  onChange={e => setRi(r => ({ ...r, tradeIn: { ...r.tradeIn, [id]: parseInt(e.target.value) || 0 } }))} />
              </div>
            ))}
            <div className="trade-row" style={{ marginTop: 6, background: 'rgba(255,255,255,0.6)', borderRadius: 12 }}>
              <span className="ic">💰</span>
              <span className="nm" style={{ fontWeight: 'bold' }}>코인</span>
              <input className="trade-input" type="number" min="0" value={ri.tradeIn.coins}
                onChange={e => setRi(r => ({ ...r, tradeIn: { ...r.tradeIn, coins: parseInt(e.target.value) || 0 } }))} />
            </div>
          </div>

          <div className="trade-panel out">
            <div style={{ fontFamily: 'Jua', fontSize: 16, color: 'var(--out-ink)', marginBottom: 10, display:'flex', alignItems:'center', gap: 6 }}>
              <span style={{ background: 'var(--out-ink)', color: 'white', borderRadius: 999, width: 22, height: 22, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize: 14 }}>−</span>
              준 자원 / 코인
            </div>
            {Object.keys(RESOURCES).map(id => (
              <div key={id} className="trade-row">
                <span className="ic">{RESOURCES[id].icon}</span>
                <span className="nm">{RESOURCES[id].name}</span>
                <input className="trade-input" type="number" min="0" value={ri.tradeOut[id]}
                  onChange={e => setRi(r => ({ ...r, tradeOut: { ...r.tradeOut, [id]: parseInt(e.target.value) || 0 } }))} />
              </div>
            ))}
            <div className="trade-row" style={{ marginTop: 6, background: 'rgba(255,255,255,0.6)', borderRadius: 12 }}>
              <span className="ic">💰</span>
              <span className="nm" style={{ fontWeight: 'bold' }}>코인</span>
              <input className="trade-input" type="number" min="0" value={ri.tradeOut.coins}
                onChange={e => setRi(r => ({ ...r, tradeOut: { ...r.tradeOut, coins: parseInt(e.target.value) || 0 } }))} />
            </div>
          </div>
        </div>

        {/* 정산 버튼 */}
        <button onClick={() => setShowConfirm(true)} disabled={settleDisabled} className="settle-btn">
          {saving ? '⏳ 저장 중...' : settleDisabled ? '😢 코인이 부족해요!' : `✅ 라운드 ${gameState.round} 정산 확정하기`}
        </button>
        {coinAfterSettle < 0 && (
          <p style={{ fontFamily: 'Gaegu', fontSize: 16, color: 'var(--berry-deep)', textAlign: 'center', marginTop: 10 }}>
            건설을 줄이거나, 자원을 팔아 코인을 더 벌어와야 해요.
          </p>
        )}
      </div>

      {showConfirm && (
        <div className="modal-bg">
          <div className="modal">
            <div style={{ fontSize: 56, marginBottom: 6 }}>📜</div>
            <h3 style={{ fontFamily: 'Jua', fontSize: 26, margin: '0 0 10px', color: 'var(--ink)' }}>정산 확인</h3>
            <p style={{ fontFamily: 'Gaegu', fontSize: 17, color: 'var(--ink-soft)', margin: '0 0 8px', lineHeight: 1.4 }}>
              입력한 데이터로 자원을 계산하고<br />라운드를 마칩니다.
            </p>
            <p style={{ fontFamily: 'Gaegu', fontSize: 15, color: '#4F8A2E', margin: '0 0 22px' }}>
              🔥 선생님 화면에 자동으로 반영됩니다!
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowConfirm(false)} className="btn3d muted" style={{ flex: 1, fontSize: 18 }}>취소</button>
              <button onClick={executeApply} className="btn3d green" style={{ flex: 1, fontSize: 18 }}>✓ 확정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  교사 대시보드 — 실시간 자동 갱신
// ─────────────────────────────────────────────────────────────
function TeacherBoard({ gameState, saveState, resetState, setMode }) {
  const { round, groups } = gameState;
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [flashGroup, setFlashGroup] = useState(null);
  const prevGroupsRef = useRef(groups);

  // 새 모둠 데이터 감지 → 플래시 효과
  useEffect(() => {
    const prev = prevGroupsRef.current;
    for (let n = 1; n <= 4; n++) {
      const prevG = prev[n];
      const currG = groups[n];
      if (currG && (!prevG || prevG.lastSubmittedRound !== currG.lastSubmittedRound)) {
        setFlashGroup(n);
        setLastUpdate(new Date());
        setTimeout(() => setFlashGroup(null), 2000);
      }
    }
    prevGroupsRef.current = groups;
  }, [groups]);

  const handleRoundChange = (newRound) => {
    saveState({ ...gameState, round: newRound });
  };

  return (
    <div className="tv-bg tv-fullscreen">
      {/* 헤더 */}
      <div className="tv-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 36 }}>📺</span>
          <div>
            <h1 className="neon-title" style={{ margin: 0, fontSize: 32 }}>마을 경제 통합 대시보드</h1>
            <p className="neon-subtle" style={{ margin: '2px 0 0', fontSize: 15 }}>
              ▸ {ROUND_LABELS[round]} 진행 중 &nbsp;·&nbsp;
              <span style={{ color: '#6CFFB1', fontSize: 13 }}>
                🔥 실시간 연동 · 마지막 갱신 {lastUpdate.toLocaleTimeString('ko-KR')}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => handleRoundChange(Math.max(1, round - 1))} className="tv-btn">◀ 이전</button>
          <button onClick={() => handleRoundChange(Math.min(8, round + 1))} className="tv-btn primary">다음 라운드 ▶</button>
          <button onClick={() => setMode('start')} className="tv-btn ghost">입력 화면으로</button>
          <button onClick={() => setShowResetConfirm(true)} className="tv-btn danger" title="데이터 전체 초기화">⚠️</button>
        </div>
      </div>

      {/* 2x2 그리드 */}
      <div className="tv-grid">
        {[1, 2, 3, 4].map(n => {
          const g = groups[n];
          const isFlashing = flashGroup === n;

          if (!g) {
            return (
              <div key={n} className="tv-empty-big">
                <div className="e">🏚️</div>
                <div>{n}모둠 · 대기 중</div>
                <div style={{ fontSize: 13, opacity: 0.6, fontFamily: 'Jua' }}>학생이 입력하면 자동으로 나타나요</div>
              </div>
            );
          }

          const isDone = g.lastSubmittedRound === round;
          const happy = calcHappiness(g.happyBase, g.facilities);
          const happyColor = happy >= 70 ? 'var(--neon-green)' : happy >= 40 ? 'var(--neon-orange)' : '#FF6B6B';
          const happyShadow = happy >= 70 ? 'rgba(108,255,177,0.7)' : happy >= 40 ? 'rgba(255,169,77,0.7)' : 'rgba(255,107,107,0.7)';

          return (
            <div key={n} className={`tv-card-big tv-${n} ${isDone ? 'done' : ''}`}
              style={isFlashing ? { boxShadow: '0 0 40px rgba(108,255,177,0.8)', border: '2px solid rgba(108,255,177,1)', transition: 'all 0.3s' } : {}}>
              {/* 새 데이터 도착 플래시 */}
              {isFlashing && (
                <div style={{ position: 'absolute', top: 8, right: 12, background: '#6CFFB1', color: '#0E1B3D', borderRadius: 999, padding: '3px 12px', fontFamily: 'Jua', fontSize: 13, zIndex: 10 }}>
                  🔥 방금 갱신됨!
                </div>
              )}
              <div className="group-tag">{n}모둠 {isDone && '· 완료 ✓'}</div>

              <div className="tv-card-head">
                <h3>{VILLAGE_THEME[n].roof} {g.name}</h3>
                <span className="trade-tag">🤝 교류 {g.tradeCount || 0}회</span>
              </div>

              <div className="tv-stats-row">
                <div className="tv-stat-big">
                  <div className="lbl">행복지수</div>
                  <div className="val" style={{ color: happyColor, textShadow: `0 0 18px ${happyShadow}` }}>{happy}</div>
                </div>
                <div className="tv-stat-big">
                  <div className="lbl">코인</div>
                  <div className="val" style={{ color: 'var(--neon-yellow)', textShadow: '0 0 18px rgba(255,228,94,0.6)' }}>💰{g.coins}</div>
                </div>
              </div>

              <div className="tv-resources-big">
                {Object.entries(RESOURCES).map(([id, r]) => {
                  const v = g.resources[id] || 0;
                  const warn = id === 'rice' && v <= 0;
                  return (
                    <div key={id} className={`tv-resource-big ${warn ? 'warn' : ''}`}>
                      <div className="ic">{r.icon}</div>
                      <div className="v">{v}</div>
                      <div className="nm">{r.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 바 */}
      <div className="tv-footer">
        <div className="tv-footer-q">
          <div className="lbl">▸ 핵심 질문</div>
          <p>Q. {ROUND_QUESTIONS[round]}</p>
        </div>
        {ROUND_EVENTS[round] && (
          <div className="tv-footer-e">
            <div style={{ fontSize: 32 }}>📢</div>
            <div>
              <div className="ev-name">{ROUND_EVENTS[round].name}</div>
              <div className="ev-desc">{ROUND_EVENTS[round].desc}</div>
            </div>
          </div>
        )}
      </div>

      {showResetConfirm && (
        <div className="modal-bg">
          <div style={{ background: 'linear-gradient(180deg, #1A2B5E, #0E1B3D)', border: '2px solid rgba(255,107,107,0.5)', boxShadow: '0 0 40px rgba(255,107,107,0.3)', borderRadius: 24, padding: 36, maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ color: 'white', fontFamily: 'Jua', fontSize: 26, margin: '0 0 10px' }}>전체 초기화</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Gaegu', fontSize: 17, marginBottom: 26, lineHeight: 1.4 }}>
              Firebase의 모든 모둠 데이터가<br />영구적으로 삭제됩니다.<br />계속하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontFamily: 'Jua', fontSize: 16, cursor: 'pointer' }}>취소</button>
              <button onClick={() => { resetState(); setShowResetConfirm(false); }} style={{ flex: 1, padding: 14, borderRadius: 14, border: '2px solid #B83C30', background: 'linear-gradient(180deg, #F4978E, #E8645A)', color: 'white', fontFamily: 'Jua', fontSize: 16, cursor: 'pointer' }}>초기화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  공통 컴포넌트
// ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, text, sub, accent, inline }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: inline ? 0 : 12 }}>
      <span style={{ fontFamily: 'Jua', fontSize: 22, color: accent || 'var(--ink)' }}>{icon} {text}</span>
      {sub && <span style={{ fontFamily: 'Gaegu', fontSize: 15, color: 'var(--ink-soft)' }}>{sub}</span>}
    </div>
  );
}

function UseResourceCard({ emoji, label, effect, stock, onClick, available, theme }) {
  return (
    <button onClick={onClick} disabled={!available}
      className={`use-card ${available ? 'glint' : ''}`}
      style={{ ...theme, border: 'none', opacity: available ? 1 : 0.55, cursor: available ? 'pointer' : 'not-allowed' }}>
      {available && (
        <>
          <span className="star" style={{ top: 6, right: 8, color: '#FFD371' }}>✨</span>
          <span className="star" style={{ bottom: 8, left: 8, color: '#FFE45E', animationDelay: '1s' }}>⭐</span>
        </>
      )}
      <div className="big-emoji">{emoji}</div>
      <div className="label">{label}</div>
      <div className="effect">{effect}</div>
      <div style={{ marginTop: 6, fontFamily: 'Gaegu', fontSize: 13, color: 'var(--c-ink)', opacity: 0.75 }}>보유 {stock}</div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
