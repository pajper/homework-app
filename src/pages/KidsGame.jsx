import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useChildAuth } from '../context/ChildAuthContext'

const SLIDE_DURATION = 7000   // ms för frågan att glida ner
const FEEDBACK_MS   = 600     // ms att visa rätt/fel innan nästa fråga
const OPTION_COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E']

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function norm(s) {
  return s?.toLowerCase().trim()
}

export default function KidsGame() {
  const { childId } = useParams()
  const navigate = useNavigate()
  const { childUser } = useChildAuth()

  const [loading, setLoading]   = useState(true)
  const [noQuestions, setNoQuestions] = useState(false)
  const [started, setStarted]   = useState(false)
  const [current, setCurrent]   = useState(null)
  const [slideKey, setSlideKey] = useState(0)
  const [answered, setAnswered] = useState(null) // null | chosen option string | 'missed'
  const [score, setScore]       = useState(0)
  const [streak, setStreak]     = useState(0)
  const [best, setBest]         = useState(0)

  const questionsRef = useRef([])
  const idxRef       = useRef(0)
  const timerRef     = useRef(null)
  const speedRef     = useRef(SLIDE_DURATION)

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

    if (idx >= qs.length) {
      qs = shuffle(qs)
      questionsRef.current = qs
      idx = 0
    }

    const q = qs[idx]
    idxRef.current = idx + 1

    setCurrent(q)
    setAnswered(null)
    setSlideKey(k => k + 1)

    timerRef.current = setTimeout(() => {
      setAnswered('missed')
      setStreak(0)
      setTimeout(showNext, FEEDBACK_MS)
    }, speedRef.current)
  }

  function startGame() {
    setStarted(true)
    setScore(0)
    setStreak(0)
    idxRef.current = 0
    speedRef.current = SLIDE_DURATION
    showNext()
  }

  function handleAnswer(opt) {
    if (answered !== null || !current) return
    clearTimeout(timerRef.current)

    const correct = norm(opt) === norm(current.correct_answer)
    setAnswered(opt)

    if (correct) {
      const newStreak = streak + 1
      const pts = newStreak >= 6 ? 3 : newStreak >= 3 ? 2 : 1
      setScore(s => s + pts)
      setStreak(newStreak)
      setBest(b => Math.max(b, newStreak))
      // Snabbare frågor efter streak
      speedRef.current = Math.max(3000, SLIDE_DURATION - newStreak * 300)
    } else {
      setStreak(0)
      speedRef.current = SLIDE_DURATION
    }

    setTimeout(showNext, FEEDBACK_MS)
  }

  // ── Render helpers ──────────────────────────────────────────────

  const multiplier = streak >= 6 ? 3 : streak >= 3 ? 2 : 1

  if (loading) return (
    <div style={bg}>
      <p style={{ color:'rgba(255,255,255,0.6)', fontFamily:'var(--font-body)' }}>Laddar frågor...</p>
    </div>
  )

  if (noQuestions) return (
    <div style={bg}>
      <p style={{ color:'#fff', fontSize:'18px', marginBottom:'1rem', fontFamily:'var(--font-display)' }}>Inga frågor ännu!</p>
      <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'14px', marginBottom:'2rem', fontFamily:'var(--font-body)' }}>Generera övningar för dina läxor först.</p>
      <button onClick={() => navigate(`/kids/${childId}`)} style={backBtn}>← Tillbaka till läxor</button>
    </div>
  )

  if (!started) return (
    <div style={bg}>
      <button onClick={() => navigate(`/kids/${childId}`)} style={{ ...backBtn, position:'absolute', top:'1.5rem', left:'1rem' }}>← Tillbaka</button>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:'64px', marginBottom:'0.5rem' }}>🎮</p>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2.5rem', fontWeight:400, color:'#fff', marginBottom:'0.5rem' }}>Läxspelet</h1>
        <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'15px', marginBottom:'0.5rem', fontFamily:'var(--font-body)' }}>
          Svara rätt innan frågan försvinner!
        </p>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'13px', marginBottom:'2.5rem', fontFamily:'var(--font-body)' }}>
          {questionsRef.current.length} frågor från dina läxor
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', alignItems:'center', marginBottom:'2rem' }}>
          {[
            ['⭐', '1 poäng per rätt svar'],
            ['🔥 x2', '3 rätt i rad = dubbla poäng'],
            ['🚀 x3', '6 rätt i rad = trippla poäng'],
            ['⚡', 'Frågorna snabbas upp!'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display:'flex', alignItems:'center', gap:'10px', color:'rgba(255,255,255,0.75)', fontSize:'14px', fontFamily:'var(--font-body)' }}>
              <span style={{ fontSize:'18px', width:'40px', textAlign:'center' }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <button onClick={startGame} style={startBtn}>Starta spelet!</button>
        {best > 0 && <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px', marginTop:'1rem', fontFamily:'var(--font-body)' }}>Bästa streak: {best} 🔥</p>}
      </div>
    </div>
  )

  return (
    <div style={{ ...bg, overflow:'hidden', position:'relative' }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-180px); }
          to   { transform: translateY(100vh); }
        }
        .q-slide { animation: slideDown linear forwards; }
      `}</style>

      {/* HUD */}
      <div style={{ position:'absolute', top:0, left:0, right:0, padding:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:10 }}>
        <button onClick={() => navigate(`/kids/${childId}`)} style={backBtn}>← Läxor</button>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          {streak >= 3 && (
            <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'12px', padding:'6px 12px', color:'#fff', fontWeight:700, fontSize:'14px', fontFamily:'var(--font-body)' }}>
              {streak >= 6 ? '🚀' : '🔥'} {streak} i rad {multiplier > 1 ? `×${multiplier}` : ''}
            </div>
          )}
          <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'12px', padding:'6px 14px', color:'#fff', fontWeight:700, fontSize:'18px', fontFamily:'var(--font-body)' }}>
            ⭐ {score}
          </div>
        </div>
      </div>

      {/* Sliding question */}
      {current && (
        <div
          key={slideKey}
          className="q-slide"
          style={{
            animationDuration: `${speedRef.current}ms`,
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(90vw, 500px)',
            zIndex: 5,
          }}
        >
          <div style={{
            background: answered === 'missed' ? 'rgba(239,68,68,0.9)'
              : answered && norm(answered) === norm(current.correct_answer) ? 'rgba(34,197,94,0.9)'
              : answered ? 'rgba(239,68,68,0.9)'
              : 'rgba(255,255,255,0.95)',
            borderRadius: '20px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transition: 'background 0.2s',
          }}>
            <p style={{
              fontSize: '18px',
              fontWeight: 600,
              lineHeight: 1.4,
              color: answered ? '#fff' : '#1A1916',
              margin: 0,
              fontFamily: 'var(--font-body)',
            }}>
              {answered === 'missed' ? '⏰ ' : answered && norm(answered) === norm(current.correct_answer) ? '✅ ' : answered ? '❌ ' : ''}
              {current.question}
            </p>
            {answered && answered !== 'missed' && norm(answered) !== norm(current.correct_answer) && (
              <p style={{ color:'rgba(255,255,255,0.85)', fontSize:'13px', margin:'6px 0 0', fontFamily:'var(--font-body)' }}>
                Rätt svar: {current.correct_answer}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Answer buttons — fixed at bottom */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        background: 'linear-gradient(to top, rgba(20,10,50,1) 70%, transparent)',
        zIndex: 20,
      }}>
        {current?.options?.map((opt, i) => {
          const isCorrect = norm(opt) === norm(current?.correct_answer)
          const isChosen  = answered === opt
          let bg = OPTION_COLORS[i % OPTION_COLORS.length]
          if (answered !== null) {
            if (isCorrect)                     bg = '#22C55E'
            else if (isChosen && !isCorrect)   bg = '#EF4444'
            else                               bg = 'rgba(255,255,255,0.15)'
          }
          return (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={answered !== null}
              style={{
                padding: '16px 12px',
                borderRadius: '16px',
                border: 'none',
                background: bg,
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: answered !== null ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.2s',
                opacity: answered !== null && !isCorrect && !isChosen ? 0.4 : 1,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Shared styles
const bg = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #1A0A3B 0%, #0F172A 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  position: 'relative',
}

const backBtn = {
  background: 'rgba(255,255,255,0.12)',
  border: 'none',
  borderRadius: '12px',
  padding: '8px 14px',
  color: '#fff',
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
}

const startBtn = {
  padding: '16px 40px',
  borderRadius: '20px',
  border: 'none',
  background: 'linear-gradient(135deg, #534AB7, #7C6FD4)',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  boxShadow: '0 4px 24px rgba(83,74,183,0.5)',
}
