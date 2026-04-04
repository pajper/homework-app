import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useChildAuth } from '../context/ChildAuthContext'

const BASE_DURATION = 7000
const FEEDBACK_MS   = 600
const OPTION_COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E']

// Vapen baserat på streak
const WEAPONS = ['🥥','🥥','🥥','🍌','🍌','🍌','🍍','🍍','🍍','🔥','🔥','🔥']
function getWeapon(streak) { return WEAPONS[Math.min(streak, WEAPONS.length - 1)] }

// Bakgrundsfärger per level
const LEVEL_BACKGROUNDS = [
  'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)',
  'linear-gradient(160deg,#0A2B1A 0%,#0A1F0F 100%)',
  'linear-gradient(160deg,#2B1A0A 0%,#1F120A 100%)',
  'linear-gradient(160deg,#2B0A0A 0%,#1F0F0F 100%)',
  'linear-gradient(160deg,#1A0A2B 0%,#120A1F 100%)',
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }
function norm(s) { return s?.toLowerCase().trim() }

export default function KidsGame() {
  const { childId } = useParams()
  const navigate    = useNavigate()
  useChildAuth()

  const [loading,     setLoading]     = useState(true)
  const [noQuestions, setNoQuestions] = useState(false)
  const [started,     setStarted]     = useState(false)
  const [current,     setCurrent]     = useState(null)
  const [slideKey,    setSlideKey]    = useState(0)
  const [answered,    setAnswered]    = useState(null)
  const [score,       setScore]       = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [best,        setBest]        = useState(0)
  const [lives,       setLives]       = useState(3)
  const [level,       setLevel]       = useState(1)
  const [gameOver,    setGameOver]    = useState(false)

  const [showProjectile, setShowProjectile] = useState(false)
  const [projectileY,    setProjectileY]    = useState(0)
  const [projectileMiss, setProjectileMiss] = useState(false)
  const [projectileType, setProjectileType] = useState('🥥')
  const [monkeyHit,      setMonkeyHit]      = useState(false)

  const [toast,     setToast]     = useState(null)  // { text, color }
  const [scorePop,  setScorePop]  = useState(null)  // '+1' '+2' '+3'

  const questionsRef  = useRef([])
  const idxRef        = useRef(0)
  const timerRef      = useRef(null)
  const toastTimer    = useRef(null)
  const durationRef   = useRef(BASE_DURATION)
  const livesRef      = useRef(3)
  const streakRef     = useRef(0)
  const scoreRef      = useRef(0)
  const levelRef      = useRef(1)
  const matsRef       = useRef([])
  const generatingRef = useRef(false)
  const historyRef    = useRef([])

  useEffect(() => { fetchQuestions() }, [childId])
  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(toastTimer.current) }, [])

  function showToast(text, color = '#fff') {
    setToast({ text, color })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  async function fetchQuestions() {
    const { data: mats } = await supabase
      .from('materials').select('id, subject, content, type').eq('child_id', childId)
    if (!mats?.length) { setNoQuestions(true); setLoading(false); return }
    matsRef.current = mats

    const { data: exs } = await supabase
      .from('exercises').select('*')
      .in('material_id', mats.map(m => m.id))
      .in('type', ['multiple_choice', 'true_false'])
    if (!exs?.length) { setNoQuestions(true); setLoading(false); return }

    questionsRef.current = shuffle(exs)
    setLoading(false)
  }

  async function generateMoreQuestions() {
    if (generatingRef.current || !matsRef.current.length) return
    generatingRef.current = true
    try {
      const mat    = matsRef.current[Math.floor(Math.random() * matsRef.current.length)]
      const isMath = mat.content?.startsWith('__MATH__:')
      const isPdf  = mat.content?.startsWith('__PDF_BASE64__:')
      const SUFFIX = `\n\nSvara ENDAST med ett JSON-array:\n[{"question":"...","type":"multiple_choice","options":["A","B","C","D"],"correct_answer":"A"}]\nType: multiple_choice eller true_false. För true_false: options=["Sant","Falskt"], correct_answer="Sant" eller "Falskt".`
      let msgContent
      if (isMath) {
        msgContent = `Skapa 10 varierade matematikfrågor (multiple_choice) för: ${mat.content.slice('__MATH__:'.length)}${SUFFIX}`
      } else if (isPdf) {
        msgContent = [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: mat.content.slice('__PDF_BASE64__:'.length) } },
          { type: 'text', text: `Skapa 10 nya varierade frågor (blanda multiple_choice och true_false) för ämnet: ${mat.subject}. Välj andra aspekter av innehållet än vanliga uppenbara frågor.${SUFFIX}` },
        ]
      } else {
        msgContent = `Skapa 10 nya varierade frågor (blanda multiple_choice och true_false) för:\nÄmne: ${mat.subject}\nMaterial: ${mat.content}\nVälj oväntat och varierande aspekter av materialet.${SUFFIX}`
      }
      const res    = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: msgContent }] }),
      })
      const aiData = await res.json()
      const parsed = JSON.parse(aiData.content[0].text.replace(/```json|```/g, '').trim())
      const newQs  = parsed.map(q => ({ ...q, material_id: mat.id, child_id: childId, id: crypto.randomUUID() }))
      supabase.from('exercises').insert(newQs).then(() => {})
      questionsRef.current = [...questionsRef.current, ...shuffle(newQs)]
    } catch (e) {
      console.error('Kunde inte generera fler frågor:', e)
    }
    generatingRef.current = false
  }

  function showNext() {
    clearTimeout(timerRef.current)
    let qs  = questionsRef.current
    let idx = idxRef.current
    if (idx >= qs.length) { qs = shuffle(qs); questionsRef.current = qs; idx = 0 }
    idxRef.current = idx + 1
    if (idx >= Math.floor(qs.length / 2)) generateMoreQuestions()

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
    durationRef.current = BASE_DURATION
    idxRef.current      = 0
    historyRef.current  = []
    setStarted(true)
    setScore(0)
    setStreak(0)
    setLives(3)
    setLevel(1)
    setGameOver(false)
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
      setBest(b => Math.max(b, newStreak))
      setScorePop(`+${pts}`)
      setTimeout(() => setScorePop(null), 700)

      // Level up var 15:e poäng
      const newLevel = Math.floor(newScore / 15) + 1
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel
        setLevel(newLevel)
        showToast(`⚡ Level ${newLevel}! Snabbare!`, '#FBBF24')
        durationRef.current = Math.max(2000, BASE_DURATION - (newLevel - 1) * 500 - newStreak * 200)
      } else {
        durationRef.current = Math.max(2000, BASE_DURATION - (levelRef.current - 1) * 500 - newStreak * 200)
      }

      // Extraliv var 5:e streak
      if (newStreak > 0 && newStreak % 5 === 0) {
        const newLives = Math.min(livesRef.current + 1, 5)
        livesRef.current = newLives
        setLives(newLives)
        showToast('❤️ Extraliv!', '#EF4444')
      } else if (newStreak === 3) {
        showToast('🍌 Bananläge! ×2', '#FCD34D')
      } else if (newStreak === 6) {
        showToast('🍍 Ananas! ×3', '#F97316')
      } else if (newStreak === 10) {
        showToast('🔥 ELDKULA! ×4', '#EF4444')
      }

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

  const multiplier = streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1
  const bgGradient = LEVEL_BACKGROUNDS[(level - 1) % LEVEL_BACKGROUNDS.length]
  const weapon     = getWeapon(streak)

  // ── Screens ────────────────────────────────────────────────────

  if (loading) return <Screen><p style={dimText}>Laddar frågor...</p></Screen>

  if (noQuestions) return (
    <Screen>
      <p style={{ color:'#fff', fontSize:'22px', marginBottom:'8px', fontFamily:'var(--font-display)' }}>Inga frågor ännu!</p>
      <p style={{ ...dimText, marginBottom:'2rem' }}>Generera övningar för dina läxor först.</p>
      <button onClick={() => navigate(`/kids/${childId}`)} style={ghostBtn}>← Tillbaka till läxor</button>
    </Screen>
  )

  if (gameOver) {
    const hist     = historyRef.current
    const nCorrect = hist.filter(h => h.result === 'correct').length
    const nWrong   = hist.filter(h => h.result === 'wrong').length
    const nMissed  = hist.filter(h => h.result === 'missed').length
    return (
      <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', fontFamily:'var(--font-body)', overflowY:'auto' }}>
        <div style={{ padding:'1.5rem 1rem 1rem', textAlign:'center' }}>
          <p style={{ fontSize:'56px', margin:'0 0 0.25rem' }}>💀</p>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'#fff', fontWeight:400, margin:'0 0 0.75rem' }}>Game over!</h2>
          {best >= 5 && <p style={{ color:'#FBBF24', fontSize:'13px', marginBottom:'0.5rem' }}>🏅 Bästa streak: {best} i rad!</p>}
          <div style={{ display:'flex', justifyContent:'center', gap:'12px', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            {[['⭐', score, 'poäng', '#fff'], ['⚡', level, 'level', '#FBBF24'], ['✅', nCorrect, 'rätt', '#22C55E'], ['❌', nWrong + nMissed, 'fel/missad', '#EF4444']].map(([icon, val, label, color]) => (
              <div key={label} style={{ background:'rgba(255,255,255,0.08)', borderRadius:'14px', padding:'10px 16px', textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color }}>{icon} {val}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
            <button onClick={startGame} style={primaryBtn}>Spela igen</button>
            <button onClick={() => navigate(`/kids/${childId}`)} style={ghostBtn}>← Läxor</button>
          </div>
        </div>
        <div style={{ padding:'0 1rem 2rem' }}>
          <p style={{ fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>
            Alla frågor — {hist.length} st
          </p>
          {hist.map((h, i) => (
            <div key={i} style={{ background: h.result === 'correct' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border:`1px solid ${h.result === 'correct' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:'14px', padding:'10px 14px', marginBottom:'8px' }}>
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                <span style={{ fontSize:'16px', flexShrink:0, marginTop:'1px' }}>
                  {h.result === 'correct' ? '✅' : h.result === 'missed' ? '⏰' : '❌'}
                </span>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#fff', fontSize:'13px', fontWeight:600, margin:'0 0 4px', lineHeight:1.4 }}>{h.question}</p>
                  {h.result !== 'correct' && (
                    <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'12px', margin:0 }}>
                      {h.result === 'missed' ? 'Hann inte svara · ' : `Du svarade: ${h.chosen} · `}
                      <span style={{ color:'#22C55E' }}>Rätt: {h.correct}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!started) return (
    <Screen>
      <button onClick={() => navigate(`/kids/${childId}`)} style={{ ...ghostBtn, position:'absolute', top:'1.5rem', left:'1rem' }}>← Tillbaka</button>
      <p style={{ fontSize:'64px', marginBottom:'0.5rem' }}>🐒</p>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2.25rem', fontWeight:400, color:'#fff', marginBottom:'0.5rem' }}>Läxspelet</h1>
      <p style={{ ...dimText, marginBottom:'1.5rem', maxWidth:'280px', textAlign:'center', lineHeight:1.6 }}>
        Stoppa apan med kokosnötter — svara rätt!
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'2rem', width:'270px' }}>
        {[
          ['❤️❤️❤️', '3 liv — missa och du förlorar ett'],
          ['🥥→🍌→🍍→🔥', 'Bättre vapen vid streak!'],
          ['❤️ Extraliv', 'Var 5:e rätt i rad'],
          ['🔥 ×2/×3/×4', 'Streak = mer poäng'],
          ['⚡ Level up', 'Var 15:e poäng — snabbare!'],
        ].map(([icon, text]) => (
          <div key={text} style={{ display:'flex', gap:'12px', alignItems:'center', color:'rgba(255,255,255,0.7)', fontSize:'13px', fontFamily:'var(--font-body)' }}>
            <span style={{ fontSize:'15px', width:'80px', textAlign:'center', flexShrink:0 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <button onClick={startGame} style={primaryBtn}>Starta spelet!</button>
      {best > 0 && <p style={{ ...dimText, fontSize:'12px', marginTop:'1rem' }}>Bästa streak: {best} 🔥</p>}
    </Screen>
  )

  // ── Main game ──────────────────────────────────────────────────

  return (
    <div style={{ minHeight:'100dvh', background: bgGradient, display:'flex', flexDirection:'column', fontFamily:'var(--font-body)', overflow:'hidden', position:'relative', transition:'background 1s' }}>
      <style>{`
        @keyframes charSlide {
          from { top: -120px; }
          to   { top: calc(100dvh - 220px - env(safe-area-inset-bottom, 0px)); }
        }
        .char-slide { animation: charSlide linear forwards; }
        @keyframes dangerPulse {
          0%,100% { opacity:0.6; } 50% { opacity:1; }
        }
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
        @keyframes scorePop {
          0%   { opacity:1; transform:translateY(0); }
          100% { opacity:0; transform:translateY(-40px); }
        }
        @keyframes livePulse {
          0%,100% { transform:scale(1); }
          50%     { transform:scale(1.3); }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:'80px', left:'50%', zIndex:100, background:'rgba(0,0,0,0.75)', color: toast.color, fontWeight:700, fontSize:'18px', borderRadius:'16px', padding:'10px 22px', animation:'toastAnim 1.8s ease forwards', pointerEvents:'none', whiteSpace:'nowrap' }}>
          {toast.text}
        </div>
      )}

      {/* Score pop */}
      {scorePop && (
        <div style={{ position:'fixed', top:'120px', right:'24px', zIndex:100, color:'#FBBF24', fontWeight:900, fontSize:'24px', animation:'scorePop 0.7s ease forwards', pointerEvents:'none' }}>
          {scorePop}
        </div>
      )}

      {/* HUD */}
      <div style={{ padding:'1rem 1rem 0', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10, flexShrink:0 }}>
        <div style={{ display:'flex', gap:'4px' }}>
          {Array.from({ length: Math.max(lives, 3) }).map((_, i) => (
            <span key={i} style={{ fontSize:'20px', opacity: i < lives ? 1 : 0.15, transition:'opacity .3s', display:'inline-block' }}>❤️</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {streak >= 3 && (
            <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 10px', color:'#FBBF24', fontWeight:700, fontSize:'13px' }}>
              {weapon} ×{multiplier}
            </div>
          )}
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 10px', color:'#fff', fontWeight:700, fontSize:'13px' }}>
            ⚡ {level}
          </div>
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 12px', color:'#fff', fontWeight:700, fontSize:'16px' }}>
            ⭐ {score}
          </div>
        </div>
      </div>

      {/* Question */}
      {current && (
        <div style={{ margin:'0.75rem 1rem 0', flexShrink:0, zIndex:10 }}>
          <div style={{
            background: answered === 'missed' ? 'rgba(239,68,68,0.85)'
              : answered && norm(answered) === norm(current.correct_answer) ? 'rgba(34,197,94,0.85)'
              : answered ? 'rgba(239,68,68,0.85)'
              : 'rgba(255,255,255,0.95)',
            borderRadius:'20px', padding:'1rem 1.25rem',
            boxShadow:'0 4px 24px rgba(0,0,0,0.4)', transition:'background 0.15s',
          }}>
            <p style={{ fontSize:'17px', fontWeight:600, lineHeight:1.4, margin:0, color: answered ? '#fff' : '#1A1916' }}>
              {answered === 'missed' ? '⏰ Missad! ' : answered && norm(answered) !== norm(current.correct_answer) ? '❌ ' : answered ? '✅ ' : ''}
              {current.question}
            </p>
            {answered && answered !== 'missed' && norm(answered) !== norm(current.correct_answer) && (
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:'13px', margin:'5px 0 0' }}>Rätt: {current.correct_answer}</p>
            )}
          </div>
        </div>
      )}

      {/* Sliding monkey */}
      {current && (
        <div
          key={slideKey}
          className="char-slide"
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 5, textAlign: 'center',
            animation: monkeyHit
              ? 'monkeyHitAnim 0.5s ease-out forwards'
              : `charSlide ${durationRef.current}ms linear forwards`,
          }}
        >
          <div style={{ fontSize:'64px', lineHeight:1 }}>🐒</div>
          {!monkeyHit && <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'rgba(255,100,100,0.4)', margin:'4px auto 0', animation:'dangerPulse 0.8s ease-in-out infinite' }} />}
        </div>
      )}

      {/* Projectile */}
      {showProjectile && (
        <div style={{
          position: 'fixed', bottom: '160px', left: '50%',
          fontSize: projectileType === '🔥' ? '52px' : '40px',
          zIndex: 50,
          animation: projectileMiss ? 'projMiss 0.55s ease-out forwards' : 'projFly 0.4s ease-in forwards',
          '--travel': projectileY,
          filter: projectileType === '🔥' ? 'drop-shadow(0 0 8px orange)' : 'none',
        }}>
          {projectileType}
        </div>
      )}

      <div style={{ flex:1 }} />

      {/* Answer buttons */}
      <div style={{ padding:'0.75rem', paddingBottom:'calc(0.75rem + env(safe-area-inset-bottom, 0px))', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', flexShrink:0, zIndex:20 }}>
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
              padding:'18px 12px', borderRadius:'16px', border:'none',
              background: bg, color:'#fff', fontSize:'15px', fontWeight:600,
              cursor: answered !== null ? 'default' : 'pointer',
              fontFamily:'var(--font-body)', lineHeight:1.3, textAlign:'center',
              transition:'background 0.15s',
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

function Screen({ children }) {
  return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', padding:'2rem', position:'relative' }}>
      {children}
    </div>
  )
}
const dimText    = { color:'rgba(255,255,255,0.55)', fontSize:'14px', fontFamily:'var(--font-body)', margin:0 }
const ghostBtn   = { background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'12px', padding:'10px 18px', color:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'var(--font-body)' }
const primaryBtn = { padding:'16px 40px', borderRadius:'20px', border:'none', background:'linear-gradient(135deg,#534AB7,#7C6FD4)', color:'#fff', fontSize:'18px', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 24px rgba(83,74,183,0.5)' }
