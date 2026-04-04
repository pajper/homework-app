import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BASE_DURATION = 7000
const FEEDBACK_MS   = 600
const OPTION_COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#BA7517']
const WEAPONS = ['🥥','🥥','🥥','🍌','🍌','🍌','🍍','🍍','🍍','🔥','🔥','🔥']
const LEVEL_BACKGROUNDS = [
  'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)',
  'linear-gradient(160deg,#0A2B1A 0%,#0A1F0F 100%)',
  'linear-gradient(160deg,#2B1A0A 0%,#1F120A 100%)',
  'linear-gradient(160deg,#2B0A0A 0%,#1F0F0F 100%)',
  'linear-gradient(160deg,#1A0A2B 0%,#120A1F 100%)',
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }
function norm(s) { return s?.toLowerCase().trim() }
function getWeapon(streak) { return WEAPONS[Math.min(streak, WEAPONS.length - 1)] }

function buildQuestions() {
  const qs = []
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      const answer = a * b
      const sameTable = []
      for (let i = 1; i <= 10; i++) {
        const v = a * i
        if (v !== answer) sameTable.push(String(v))
      }
      const neighbors = []
      for (let d = -3; d <= 3; d++) {
        const v = answer + d
        if (d !== 0 && v > 0 && !sameTable.includes(String(v))) neighbors.push(String(v))
      }
      const pool = shuffle([...sameTable, ...neighbors])
      const options = shuffle([String(answer), ...pool.slice(0, 5)])
      qs.push({ id: `mult-${a}-${b}`, type: 'multiple_choice', question: `${a} × ${b} = ?`, options, correct_answer: String(answer) })
    }
  }
  return shuffle(qs)
}

export default function MultiplicationGame() {
  const navigate = useNavigate()

  const [started,    setStarted]    = useState(false)
  const [current,    setCurrent]    = useState(null)
  const [slideKey,   setSlideKey]   = useState(0)
  const [answered,   setAnswered]   = useState(null)
  const [score,      setScore]      = useState(0)
  const [streak,     setStreak]     = useState(0)
  const [best,       setBest]       = useState(0)
  const [lives,      setLives]      = useState(3)
  const [level,      setLevel]      = useState(1)
  const [gameOver,   setGameOver]   = useState(false)
  const [showProjectile, setShowProjectile] = useState(false)
  const [projectileY,    setProjectileY]    = useState(0)
  const [projectileMiss, setProjectileMiss] = useState(false)
  const [projectileType, setProjectileType] = useState('🥥')
  const [monkeyHit,  setMonkeyHit]  = useState(false)
  const [toast,      setToast]      = useState(null)
  const [scorePop,   setScorePop]   = useState(null)

  const [playerName, setPlayerName] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [savedId,    setSavedId]    = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  const questionsRef  = useRef(buildQuestions())
  const idxRef        = useRef(0)
  const timerRef      = useRef(null)
  const toastTimer    = useRef(null)
  const durationRef   = useRef(BASE_DURATION)
  const livesRef      = useRef(3)
  const streakRef     = useRef(0)
  const scoreRef      = useRef(0)
  const levelRef      = useRef(1)
  const historyRef    = useRef([])
  const bestRef       = useRef(0)

  useEffect(() => {
    fetchLeaderboard()
    return () => { clearTimeout(timerRef.current); clearTimeout(toastTimer.current) }
  }, [])

  async function fetchLeaderboard() {
    const { data } = await supabase
      .from('multiplication_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(10)
    if (data) setLeaderboard(data)
  }

  async function saveScore() {
    if (!playerName.trim()) return
    setSaving(true)
    const hist = historyRef.current
    const nCorrect = hist.filter(h => h.result === 'correct').length
    const { data } = await supabase
      .from('multiplication_scores')
      .insert({
        name: playerName.trim(),
        score: scoreRef.current,
        level: levelRef.current,
        best_streak: bestRef.current,
        correct: nCorrect,
        total: hist.length,
      })
      .select()
      .single()
    if (data) setSavedId(data.id)
    await fetchLeaderboard()
    setSaving(false)
    setSaved(true)
  }

  function showToast(text, color = '#fff') {
    setToast({ text, color })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  function showNext() {
    clearTimeout(timerRef.current)
    let qs  = questionsRef.current
    let idx = idxRef.current
    if (idx >= qs.length) { qs = shuffle(qs); questionsRef.current = qs; idx = 0 }
    idxRef.current = idx + 1

    setCurrent(qs[idx])
    setAnswered(null)
    setMonkeyHit(false)
    setShowProjectile(false)
    setProjectileMiss(false)
    setSlideKey(k => k + 1)

    timerRef.current = setTimeout(() => {
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      streakRef.current = 0
      setStreak(0)
      durationRef.current = Math.max(2500, BASE_DURATION - (levelRef.current - 1) * 500)
      setAnswered('missed')
      historyRef.current.push({ question: qs[idx]?.question, chosen: null, correct: qs[idx]?.correct_answer, result: 'missed' })
      if (newLives <= 0) setTimeout(() => setGameOver(true), FEEDBACK_MS)
      else setTimeout(showNext, FEEDBACK_MS)
    }, durationRef.current)
  }

  function startGame() {
    livesRef.current    = 3
    streakRef.current   = 0
    scoreRef.current    = 0
    levelRef.current    = 1
    bestRef.current     = 0
    durationRef.current = BASE_DURATION
    idxRef.current      = 0
    historyRef.current  = []
    questionsRef.current = buildQuestions()
    setStarted(true)
    setScore(0)
    setStreak(0)
    setBest(0)
    setLives(3)
    setLevel(1)
    setGameOver(false)
    setSaved(false)
    setSavedId(null)
    setPlayerName('')
    showNext()
  }

  function fireProjectile(hit) {
    const weapon = getWeapon(streakRef.current)
    setProjectileType(weapon)
    const monkeyEl = document.querySelector('.char-slide')
    if (monkeyEl) {
      const rect = monkeyEl.getBoundingClientRect()
      setProjectileY(-(window.innerHeight - 160 - (rect.top + rect.height / 2)))
    }
    setProjectileMiss(!hit)
    setShowProjectile(true)
    if (hit) setTimeout(() => setMonkeyHit(true), 350)
  }

  function handleAnswer(opt) {
    if (answered !== null || !current) return
    clearTimeout(timerRef.current)

    const correct = norm(opt) === norm(current.correct_answer)
    setAnswered(opt)
    historyRef.current.push({ question: current.question, chosen: opt, correct: current.correct_answer, result: correct ? 'correct' : 'wrong' })

    if (correct) {
      const newStreak = streakRef.current + 1
      const pts = newStreak >= 10 ? 4 : newStreak >= 6 ? 3 : newStreak >= 3 ? 2 : 1
      streakRef.current = newStreak
      setStreak(newStreak)
      const newScore = scoreRef.current + pts
      scoreRef.current = newScore
      setScore(newScore)
      const newBest = Math.max(bestRef.current, newStreak)
      bestRef.current = newBest
      setBest(newBest)
      setScorePop(`+${pts}`)
      setTimeout(() => setScorePop(null), 700)

      const newLevel = Math.floor(newScore / 15) + 1
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel
        setLevel(newLevel)
        showToast(`⚡ Level ${newLevel}! Snabbare!`, '#FBBF24')
        durationRef.current = Math.max(2000, BASE_DURATION - (newLevel - 1) * 500 - newStreak * 200)
      } else {
        durationRef.current = Math.max(2000, BASE_DURATION - (levelRef.current - 1) * 500 - newStreak * 200)
      }

      if (newStreak > 0 && newStreak % 5 === 0) {
        const newLives = Math.min(livesRef.current + 1, 5)
        livesRef.current = newLives
        setLives(newLives)
        showToast('❤️ Extraliv!', '#EF4444')
      } else if (newStreak === 3) showToast('🍌 Bananläge! ×2', '#FCD34D')
      else if (newStreak === 6) showToast('🍍 Ananas! ×3', '#F97316')
      else if (newStreak === 10) showToast('🔥 ELDKULA! ×4', '#EF4444')

      fireProjectile(true)
    } else {
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      streakRef.current = 0
      setStreak(0)
      durationRef.current = Math.max(2500, BASE_DURATION - (levelRef.current - 1) * 500)
      fireProjectile(false)
    }

    if (livesRef.current <= 0) setTimeout(() => setGameOver(true), FEEDBACK_MS)
    else setTimeout(showNext, FEEDBACK_MS)
  }

  const multiplier  = streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1
  const bgGradient  = LEVEL_BACKGROUNDS[(level - 1) % LEVEL_BACKGROUNDS.length]
  const weapon      = getWeapon(streak)

  if (gameOver) {
    const hist     = historyRef.current
    const nCorrect = hist.filter(h => h.result === 'correct').length
    const nMissed  = hist.filter(h => h.result !== 'correct').length
    return (
      <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', fontFamily:'var(--font-body)', overflowY:'auto' }}>
        <div style={{ padding:'1.5rem 1rem 1rem', textAlign:'center' }}>
          <p style={{ fontSize:'56px', margin:'0 0 0.25rem' }}>💀</p>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'#fff', fontWeight:400, margin:'0 0 0.75rem' }}>Game over!</h2>
          {best >= 5 && <p style={{ color:'#FBBF24', fontSize:'13px', marginBottom:'0.5rem' }}>🏅 Bästa streak: {best} i rad!</p>}
          <div style={{ display:'flex', justifyContent:'center', gap:'12px', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            {[['⭐', scoreRef.current, 'poäng', '#fff'], ['⚡', levelRef.current, 'level', '#FBBF24'], ['✅', nCorrect, 'rätt', '#22C55E'], ['❌', nMissed, 'fel/missad', '#EF4444']].map(([icon, val, label, color]) => (
              <div key={label} style={{ background:'rgba(255,255,255,0.08)', borderRadius:'14px', padding:'10px 16px', textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color }}>{icon} {val}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Save score */}
          {!saved ? (
            <div style={{ marginBottom:'1.25rem' }}>
              <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px', marginBottom:'10px' }}>Spara ditt resultat i topplistan!</p>
              <div style={{ display:'flex', gap:'8px', justifyContent:'center', maxWidth:'320px', margin:'0 auto' }}>
                <input
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !saving && saveScore()}
                  placeholder="Ditt namn"
                  maxLength={20}
                  style={{ flex:1, padding:'12px 16px', borderRadius:'14px', border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:'16px', fontFamily:'var(--font-body)', outline:'none' }}
                />
                <button onClick={saveScore} disabled={saving || !playerName.trim()} style={{ ...primaryBtn, padding:'12px 20px', fontSize:'15px', opacity: !playerName.trim() ? 0.5 : 1 }}>
                  {saving ? '...' : 'Spara'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom:'1.25rem' }}>
              <p style={{ color:'#22C55E', fontSize:'15px', fontWeight:700 }}>✅ Sparat!</p>
              <Leaderboard entries={leaderboard} highlightId={savedId} />
            </div>
          )}

          <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom: saved ? '0' : '1rem' }}>
            <button onClick={startGame} style={primaryBtn}>Spela igen</button>
            {!saved && <button onClick={() => { setSaved(true) }} style={ghostBtn}>Hoppa över</button>}
          </div>
          {!saved && leaderboard.length > 0 && (
            <div style={{ marginTop:'1rem' }}>
              <Leaderboard entries={leaderboard} highlightId={null} />
            </div>
          )}
        </div>

        <div style={{ padding:'0 1rem 2rem' }}>
          <p style={{ fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>
            Alla frågor — {hist.length} st
          </p>
          {hist.map((h, i) => (
            <div key={i} style={{ background: h.result === 'correct' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border:`1px solid ${h.result === 'correct' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'14px', padding:'10px 14px', marginBottom:'8px' }}>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <span style={{ fontSize:'16px' }}>{h.result === 'correct' ? '✅' : h.result === 'missed' ? '⏰' : '❌'}</span>
                <p style={{ color:'#fff', fontSize:'14px', fontWeight:700, margin:0 }}>{h.question}</p>
                {h.result !== 'correct' && <p style={{ color:'#22C55E', fontSize:'13px', margin:'0 0 0 auto' }}>{h.correct}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!started) return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', padding:'2rem', overflowY:'auto' }}>
      <p style={{ fontSize:'56px', marginBottom:'0.5rem' }}>✖️</p>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2.25rem', fontWeight:400, color:'#fff', marginBottom:'0.5rem' }}>Multiplikation</h1>
      <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'14px', marginBottom:'1.5rem', textAlign:'center', maxWidth:'260px', lineHeight:1.6, fontFamily:'var(--font-body)' }}>
        Träna 1–10:ans tabell! Stoppa apan med rätt svar.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:'7px', marginBottom:'2rem', width:'270px' }}>
        {[['🥥→🍌→🍍→🔥','Bättre vapen vid streak'],['❤️ Extraliv','Var 5:e rätt i rad'],['🔥 ×2/×3/×4','Streak = mer poäng'],['⚡ Level up','Var 15:e poäng — snabbare!']].map(([icon, text]) => (
          <div key={text} style={{ display:'flex', gap:'12px', alignItems:'center', color:'rgba(255,255,255,0.65)', fontSize:'13px', fontFamily:'var(--font-body)' }}>
            <span style={{ fontSize:'14px', width:'80px', textAlign:'center', flexShrink:0 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <button onClick={startGame} style={primaryBtn}>Starta!</button>
      {leaderboard.length > 0 && (
        <div style={{ marginTop:'2rem', width:'100%', maxWidth:'340px' }}>
          <Leaderboard entries={leaderboard} highlightId={null} />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background: bgGradient, display:'flex', flexDirection:'column', fontFamily:'var(--font-body)', overflow:'hidden', position:'relative', transition:'background 1s' }}>
      <style>{`
        @keyframes charSlide {
          from { top: -120px; }
          to   { top: calc(100dvh - 220px - env(safe-area-inset-bottom, 0px)); }
        }
        .char-slide { animation: charSlide linear forwards; }
        @keyframes dangerPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        @keyframes projFly {
          from { transform: translate(-50%, 0) rotate(0deg); opacity:1; }
          to   { transform: translate(-50%, calc(var(--travel) * 1px)) rotate(720deg); opacity:1; }
        }
        @keyframes projMiss {
          0%   { transform: translate(-50%, 0) rotate(0deg); opacity:1; }
          60%  { transform: translate(calc(-50% + 140px), calc(var(--travel) * 0.6px)) rotate(400deg); opacity:1; }
          100% { transform: translate(calc(-50% + 280px), calc(var(--travel) * 0.3px)) rotate(700deg); opacity:0; }
        }
        @keyframes monkeyHitAnim {
          0%   { transform: translateX(-50%) scale(1) rotate(0deg); opacity:1; }
          30%  { transform: translateX(-50%) scale(1.5) rotate(-30deg); opacity:1; }
          60%  { transform: translateX(-50%) scale(0.5) rotate(25deg); opacity:0.7; }
          100% { transform: translateX(-50%) scale(0) rotate(60deg); opacity:0; }
        }
        @keyframes toastAnim {
          0%   { opacity:0; transform:translateY(10px) translateX(-50%); }
          15%  { opacity:1; transform:translateY(0) translateX(-50%); }
          80%  { opacity:1; transform:translateY(0) translateX(-50%); }
          100% { opacity:0; transform:translateY(-10px) translateX(-50%); }
        }
        @keyframes scorePop { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-40px); } }
      `}</style>

      {toast && (
        <div style={{ position:'fixed', top:'80px', left:'50%', zIndex:100, background:'rgba(0,0,0,0.75)', color:toast.color, fontWeight:700, fontSize:'18px', borderRadius:'16px', padding:'10px 22px', animation:'toastAnim 1.8s ease forwards', pointerEvents:'none', whiteSpace:'nowrap' }}>
          {toast.text}
        </div>
      )}
      {scorePop && (
        <div style={{ position:'fixed', top:'120px', right:'24px', zIndex:100, color:'#FBBF24', fontWeight:900, fontSize:'24px', animation:'scorePop 0.7s ease forwards', pointerEvents:'none' }}>
          {scorePop}
        </div>
      )}

      {/* HUD */}
      <div style={{ padding:'1rem 1rem 0', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10, flexShrink:0 }}>
        <div style={{ display:'flex', gap:'4px' }}>
          {Array.from({ length: Math.max(lives, 3) }).map((_, i) => (
            <span key={i} style={{ fontSize:'20px', opacity: i < lives ? 1 : 0.15, transition:'opacity .3s' }}>❤️</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {streak >= 3 && (
            <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 10px', color:'#FBBF24', fontWeight:700, fontSize:'13px' }}>
              {weapon} ×{multiplier}
            </div>
          )}
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 10px', color:'#fff', fontWeight:700, fontSize:'13px' }}>⚡ {level}</div>
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 12px', color:'#fff', fontWeight:700, fontSize:'16px' }}>⭐ {score}</div>
        </div>
      </div>

      {/* Question */}
      {current && (
        <div style={{ margin:'0.75rem 1rem 0', flexShrink:0, zIndex:10 }}>
          <div style={{
            background: answered === 'missed' ? 'rgba(239,68,68,0.85)' : answered && norm(answered) === norm(current.correct_answer) ? 'rgba(34,197,94,0.85)' : answered ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.95)',
            borderRadius:'20px', padding:'1rem 1.25rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4)', transition:'background 0.15s',
          }}>
            <p style={{ fontSize:'28px', fontWeight:700, lineHeight:1.2, margin:0, color: answered ? '#fff' : '#1A1916', textAlign:'center', letterSpacing:'0.02em' }}>
              {answered === 'missed' ? '⏰ ' : answered && norm(answered) !== norm(current.correct_answer) ? '❌ ' : answered ? '✅ ' : ''}
              {current.question}
            </p>
            {answered && answered !== 'missed' && norm(answered) !== norm(current.correct_answer) && (
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:'14px', margin:'5px 0 0', textAlign:'center' }}>Rätt svar: {current.correct_answer}</p>
            )}
          </div>
        </div>
      )}

      {/* Monkey */}
      {current && (
        <div key={slideKey} className="char-slide" style={{
          position:'absolute', left:'50%', transform:'translateX(-50%)', zIndex:5, textAlign:'center',
          animation: monkeyHit ? 'monkeyHitAnim 0.5s ease-out forwards' : `charSlide ${durationRef.current}ms linear forwards`,
        }}>
          <div style={{ fontSize:'64px', lineHeight:1 }}>🐒</div>
          {!monkeyHit && <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'rgba(255,100,100,0.4)', margin:'4px auto 0', animation:'dangerPulse 0.8s ease-in-out infinite' }} />}
        </div>
      )}

      {/* Projectile */}
      {showProjectile && (
        <div style={{
          position:'fixed', bottom:'160px', left:'50%', fontSize: projectileType === '🔥' ? '52px' : '40px', zIndex:50,
          animation: projectileMiss ? 'projMiss 0.55s ease-out forwards' : 'projFly 0.4s ease-in forwards',
          '--travel': projectileY, filter: projectileType === '🔥' ? 'drop-shadow(0 0 8px orange)' : 'none',
        }}>
          {projectileType}
        </div>
      )}

      <div style={{ flex:1 }} />

      {/* 6 answer buttons in 3 columns */}
      <div style={{ padding:'0.75rem', paddingBottom:'calc(0.75rem + env(safe-area-inset-bottom, 0px))', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', flexShrink:0, zIndex:20 }}>
        {current?.options?.map((opt, i) => {
          const isCorrect = norm(opt) === norm(current?.correct_answer)
          const isChosen  = answered === opt
          let bg = OPTION_COLORS[i % OPTION_COLORS.length]
          if (answered !== null) {
            if (isCorrect) bg = '#22C55E'
            else if (isChosen) bg = '#EF4444'
            else bg = 'rgba(255,255,255,0.1)'
          }
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} disabled={answered !== null} style={{
              padding:'16px 6px', borderRadius:'16px', border:'none', background:bg, color:'#fff',
              fontSize:'22px', fontWeight:700, cursor: answered !== null ? 'default' : 'pointer',
              fontFamily:'var(--font-body)', textAlign:'center', transition:'background 0.15s',
              opacity: answered !== null && !isCorrect && !isChosen ? 0.3 : 1,
              boxShadow: answered === null ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
            }}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Leaderboard({ entries, highlightId }) {
  const medals = ['🥇','🥈','🥉']
  return (
    <div style={{ width:'100%' }}>
      <p style={{ fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px', textAlign:'left' }}>
        Topplista
      </p>
      {entries.map((e, i) => {
        const isMe = e.id === highlightId
        return (
          <div key={e.id} style={{
            display:'flex', alignItems:'center', gap:'10px',
            background: isMe ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.06)',
            border: isMe ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius:'14px', padding:'10px 14px', marginBottom:'6px',
          }}>
            <span style={{ fontSize:'18px', width:'28px', textAlign:'center', flexShrink:0 }}>
              {medals[i] ?? `${i + 1}.`}
            </span>
            <span style={{ color: isMe ? '#FBBF24' : '#fff', fontWeight: isMe ? 700 : 500, fontSize:'15px', flex:1, textAlign:'left' }}>
              {e.name}
            </span>
            <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:'15px' }}>⭐ {e.score}</span>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'12px' }}>⚡{e.level}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const primaryBtn = { padding:'16px 40px', borderRadius:'20px', border:'none', background:'linear-gradient(135deg,#534AB7,#7C6FD4)', color:'#fff', fontSize:'18px', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 24px rgba(83,74,183,0.5)' }
const ghostBtn   = { background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'12px', padding:'10px 18px', color:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'var(--font-body)' }
