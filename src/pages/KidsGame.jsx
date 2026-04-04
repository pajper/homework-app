import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useChildAuth } from '../context/ChildAuthContext'

const BASE_DURATION = 7000
const FEEDBACK_MS   = 700
const OPTION_COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E']
const CHARACTERS    = ['👾', '🤖', '👻', '🐉', '🦹', '🧟', '🐙', '🦑', '👿', '🎃']

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }
function norm(s) { return s?.toLowerCase().trim() }

export default function KidsGame() {
  const { childId } = useParams()
  const navigate    = useNavigate()
  const { childUser } = useChildAuth()

  const [loading,     setLoading]     = useState(true)
  const [noQuestions, setNoQuestions] = useState(false)
  const [started,     setStarted]     = useState(false)
  const [current,     setCurrent]     = useState(null)
  const [character,   setCharacter]   = useState('👾')
  const [slideKey,    setSlideKey]    = useState(0)
  const [answered,    setAnswered]    = useState(null)
  const [score,       setScore]       = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [best,        setBest]        = useState(0)
  const [lives,       setLives]       = useState(3)
  const [gameOver,    setGameOver]    = useState(false)

  const questionsRef = useRef([])
  const idxRef       = useRef(0)
  const timerRef     = useRef(null)
  const durationRef  = useRef(BASE_DURATION)
  const livesRef     = useRef(3)
  const streakRef    = useRef(0)

  useEffect(() => { fetchQuestions() }, [childId])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  async function fetchQuestions() {
    const { data: mats } = await supabase
      .from('materials').select('id').eq('child_id', childId)
    if (!mats?.length) { setNoQuestions(true); setLoading(false); return }

    const { data: exs } = await supabase
      .from('exercises').select('*')
      .in('material_id', mats.map(m => m.id))
      .eq('type', 'multiple_choice')
    if (!exs?.length) { setNoQuestions(true); setLoading(false); return }

    questionsRef.current = shuffle(exs)
    setLoading(false)
  }

  function showNext() {
    clearTimeout(timerRef.current)
    let qs  = questionsRef.current
    let idx = idxRef.current
    if (idx >= qs.length) { qs = shuffle(qs); questionsRef.current = qs; idx = 0 }
    idxRef.current = idx + 1

    const q   = qs[idx]
    const chr = CHARACTERS[idx % CHARACTERS.length]

    setCurrent(q)
    setCharacter(chr)
    setAnswered(null)
    setSlideKey(k => k + 1)

    timerRef.current = setTimeout(() => {
      // Character reached bottom — lose a life
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      streakRef.current = 0
      setStreak(0)
      durationRef.current = BASE_DURATION

      setAnswered('missed')

      if (newLives <= 0) {
        setTimeout(() => setGameOver(true), FEEDBACK_MS)
      } else {
        setTimeout(showNext, FEEDBACK_MS)
      }
    }, durationRef.current)
  }

  function startGame() {
    livesRef.current  = 3
    streakRef.current = 0
    durationRef.current = BASE_DURATION
    idxRef.current    = 0
    setStarted(true)
    setScore(0)
    setStreak(0)
    setLives(3)
    setGameOver(false)
    showNext()
  }

  function handleAnswer(opt) {
    if (answered !== null || !current) return
    clearTimeout(timerRef.current)

    const correct = norm(opt) === norm(current.correct_answer)
    setAnswered(opt)

    if (correct) {
      const newStreak = streakRef.current + 1
      const pts = newStreak >= 6 ? 3 : newStreak >= 3 ? 2 : 1
      streakRef.current = newStreak
      setStreak(newStreak)
      setScore(s => s + pts)
      setBest(b => Math.max(b, newStreak))
      durationRef.current = Math.max(2500, BASE_DURATION - newStreak * 300)
    } else {
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      streakRef.current = 0
      setStreak(0)
      durationRef.current = BASE_DURATION
    }

    if (livesRef.current <= 0) {
      setTimeout(() => setGameOver(true), FEEDBACK_MS)
    } else {
      setTimeout(showNext, FEEDBACK_MS)
    }
  }

  const multiplier = streak >= 6 ? 3 : streak >= 3 ? 2 : 1

  // ── Screens ────────────────────────────────────────────────────

  if (loading) return <Screen><p style={dimText}>Laddar frågor...</p></Screen>

  if (noQuestions) return (
    <Screen>
      <p style={{ color:'#fff', fontSize:'22px', marginBottom:'8px', fontFamily:'var(--font-display)' }}>Inga frågor ännu!</p>
      <p style={{ ...dimText, marginBottom:'2rem' }}>Generera övningar för dina läxor först.</p>
      <button onClick={() => navigate(`/kids/${childId}`)} style={ghostBtn}>← Tillbaka till läxor</button>
    </Screen>
  )

  if (gameOver) return (
    <Screen>
      <p style={{ fontSize:'72px', marginBottom:'0.5rem' }}>💀</p>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'#fff', fontWeight:400, marginBottom:'0.25rem' }}>Game over!</h2>
      <p style={{ ...dimText, marginBottom:'0.25rem' }}>Poäng: <strong style={{ color:'#fff' }}>{score}</strong></p>
      {best > 0 && <p style={{ ...dimText, marginBottom:'2rem' }}>Bästa streak: 🔥 {best}</p>}
      <button onClick={startGame} style={primaryBtn}>Spela igen</button>
      <button onClick={() => navigate(`/kids/${childId}`)} style={{ ...ghostBtn, marginTop:'10px' }}>← Tillbaka till läxor</button>
    </Screen>
  )

  if (!started) return (
    <Screen>
      <button onClick={() => navigate(`/kids/${childId}`)} style={{ ...ghostBtn, position:'absolute', top:'1.5rem', left:'1rem' }}>← Tillbaka</button>
      <p style={{ fontSize:'64px', marginBottom:'0.5rem' }}>🎮</p>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2.25rem', fontWeight:400, color:'#fff', marginBottom:'0.5rem' }}>Läxspelet</h1>
      <p style={{ ...dimText, marginBottom:'2rem', maxWidth:'280px', textAlign:'center', lineHeight:1.6 }}>
        Stoppa figurerna innan de når dina svarsknappar — svara rätt!
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'2rem', width:'260px' }}>
        {[['❤️❤️❤️','3 liv — missa och du förlorar ett'],['🔥 ×2','3 rätt i rad = dubbla poäng'],['🚀 ×3','6 rätt i rad = trippla poäng'],['⚡','Figurerna snabbas upp!']].map(([icon, text]) => (
          <div key={text} style={{ display:'flex', gap:'12px', alignItems:'center', color:'rgba(255,255,255,0.7)', fontSize:'13px', fontFamily:'var(--font-body)' }}>
            <span style={{ fontSize:'16px', width:'52px', textAlign:'center', flexShrink:0 }}>{icon}</span>
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
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', display:'flex', flexDirection:'column', fontFamily:'var(--font-body)', overflow:'hidden', position:'relative' }}>
      <style>{`
        @keyframes charSlide {
          from { top: -120px; }
          to   { top: calc(100vh - 180px); }
        }
        .char-slide { animation: charSlide linear forwards; }

        @keyframes dangerPulse {
          0%,100% { opacity:0.6; } 50% { opacity:1; }
        }
      `}</style>

      {/* HUD */}
      <div style={{ padding:'1rem 1rem 0', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10, flexShrink:0 }}>
        <div style={{ display:'flex', gap:'6px' }}>
          {[1,2,3].map(i => (
            <span key={i} style={{ fontSize:'22px', opacity: i <= lives ? 1 : 0.2, transition:'opacity .3s' }}>❤️</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          {streak >= 3 && (
            <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'5px 10px', color:'#fff', fontWeight:700, fontSize:'13px' }}>
              {streak >= 6 ? '🚀' : '🔥'} ×{multiplier}
            </div>
          )}
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'5px 12px', color:'#fff', fontWeight:700, fontSize:'16px' }}>
            ⭐ {score}
          </div>
        </div>
      </div>

      {/* Question — static at top */}
      {current && (
        <div style={{ margin:'1rem 1rem 0', flexShrink:0, zIndex:10 }}>
          <div style={{
            background: answered === 'missed' ? 'rgba(239,68,68,0.85)'
              : answered && norm(answered) === norm(current.correct_answer) ? 'rgba(34,197,94,0.85)'
              : answered ? 'rgba(239,68,68,0.85)'
              : 'rgba(255,255,255,0.95)',
            borderRadius:'20px',
            padding:'1.25rem 1.5rem',
            boxShadow:'0 4px 24px rgba(0,0,0,0.4)',
            transition:'background 0.15s',
          }}>
            <p style={{
              fontSize:'18px', fontWeight:600, lineHeight:1.4, margin:0,
              color: answered ? '#fff' : '#1A1916',
            }}>
              {answered === 'missed' ? '⏰ Missad! ' : answered && norm(answered) !== norm(current.correct_answer) ? '❌ ' : answered ? '✅ ' : ''}
              {current.question}
            </p>
            {answered && answered !== 'missed' && norm(answered) !== norm(current.correct_answer) && (
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:'13px', margin:'6px 0 0' }}>
                Rätt: {current.correct_answer}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sliding character */}
      {current && (
        <div
          key={slideKey}
          className="char-slide"
          style={{ animationDuration:`${durationRef.current}ms`, position:'absolute', left:'50%', transform:'translateX(-50%)', zIndex:5, textAlign:'center' }}
        >
          <div style={{ fontSize:'64px', filter:'drop-shadow(0 0 12px rgba(255,100,100,0.6))', lineHeight:1 }}>
            {character}
          </div>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'rgba(255,100,100,0.4)', margin:'4px auto 0', animation:'dangerPulse 0.8s ease-in-out infinite' }} />
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex:1 }} />

      {/* Answer buttons */}
      <div style={{ padding:'0.75rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', flexShrink:0, zIndex:20 }}>
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
              background:bg, color:'#fff', fontSize:'15px', fontWeight:600,
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

// ── Shared styles ──────────────────────────────────────────────
function Screen({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#1A0A3B 0%,#0F172A 100%)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', padding:'2rem', position:'relative' }}>
      {children}
    </div>
  )
}
const dimText    = { color:'rgba(255,255,255,0.55)', fontSize:'14px', fontFamily:'var(--font-body)', margin:0 }
const ghostBtn   = { background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'12px', padding:'10px 18px', color:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'var(--font-body)' }
const primaryBtn = { padding:'16px 40px', borderRadius:'20px', border:'none', background:'linear-gradient(135deg,#534AB7,#7C6FD4)', color:'#fff', fontSize:'18px', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 24px rgba(83,74,183,0.5)' }
