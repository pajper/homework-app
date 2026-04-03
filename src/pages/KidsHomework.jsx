import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useChildAuth } from '../context/ChildAuthContext'

const SUBJECT_EMOJIS = {
  matematik: '🔢', matte: '🔢',
  svenska: '📚',
  engelska: '🌍',
  historia: '🏛️',
  geografi: '🗺️',
  biologi: '🌿', bio: '🌿',
  kemi: '⚗️',
  fysik: '⚡',
  musik: '🎵',
  idrott: '⚽',
  teknik: '🔧',
  so: '🌏',
  no: '🔬',
}

const CARD_COLORS = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#BA7517']

function getEmoji(subject) {
  const lower = subject?.toLowerCase() ?? ''
  for (const [key, emoji] of Object.entries(SUBJECT_EMOJIS)) {
    if (lower.includes(key)) return emoji
  }
  return '📖'
}

const norm = (s) => s?.toLowerCase().trim()

async function learnMore(question, subject) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Jag är ett skolbarn och lär mig om "${subject}". Sök på webben och berätta något kul och intressant om detta ämne på svenska. Max 3-4 meningar, enkelt och roligt språk för barn.\n\nFrågan vi just diskuterade: ${question}`,
      }],
    }),
  })
  const data = await response.json()
  const textParts = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  return textParts || 'Kunde inte hitta mer information just nu.'
}

async function askAI(question, userAnswer, correctAnswer) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Du är en hjälpsam och uppmuntrande lärare för skolbarn. Bedöm barnets svar på följande fråga. Svara på svenska i 2-3 korta meningar. Var vänlig och uppmuntrande oavsett om svaret är rätt eller fel.

Fråga: ${question}
Barnets svar: ${userAnswer || '(inget svar)'}
Facit: ${correctAnswer}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content[0].text
}

function ExerciseItem({ exercise, index, total, onAnswer, subject }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [openAnswer, setOpenAnswer] = useState('')
  const [aiFeedback, setAiFeedback] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [webInfo, setWebInfo] = useState(null)
  const [loadingWeb, setLoadingWeb] = useState(false)

  const isCorrect = (exercise.type === 'multiple_choice' || exercise.type === 'true_false')
    ? norm(selected) === norm(exercise.correct_answer)
    : null

  function handleReveal() {
    setRevealed(true)
    onAnswer(isCorrect) // null for open questions
  }

  async function handleLearnMore() {
    setLoadingWeb(true)
    try {
      const info = await learnMore(exercise.question, subject)
      setWebInfo(info)
    } catch (e) {
      setWebInfo('Något gick fel. Försök igen.')
    }
    setLoadingWeb(false)
  }

  async function handleAskAI() {
    setLoadingAI(true)
    try {
      const feedback = await askAI(exercise.question, openAnswer, exercise.correct_answer)
      setAiFeedback(feedback)
    } catch (e) {
      setAiFeedback('Något gick fel. Försök igen.')
    }
    setLoadingAI(false)
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '20px',
      padding: '1.25rem',
      marginBottom: '12px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: revealed
        ? isCorrect === true ? '2px solid #22C55E'
        : isCorrect === false ? '2px solid #EF4444'
        : '2px solid transparent'
        : '2px solid transparent',
      transition: 'border-color .3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9E9B94', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Fråga {index + 1} av {total}
        </span>
        {revealed && isCorrect === true && <span style={{ fontSize: '20px' }}>⭐</span>}
        {revealed && isCorrect === false && <span style={{ fontSize: '20px' }}>💪</span>}
      </div>

      <p style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.5, marginBottom: '1rem', color: '#1A1916' }}>
        {exercise.question}
      </p>

      {exercise.type === 'multiple_choice' && exercise.options && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          {exercise.options.map(opt => {
            const isThis = norm(opt) === norm(exercise.correct_answer)
            const isSelected = selected === opt
            let bg = '#F8F6F1', border = '#E5E2DC', color = '#1A1916'
            if (revealed && isThis) { bg = '#DCFCE7'; border = '#22C55E'; color = '#15803D' }
            else if (revealed && isSelected && !isThis) { bg = '#FEE2E2'; border = '#EF4444'; color = '#B91C1C' }
            else if (!revealed && isSelected) { bg = '#EEEDFE'; border = '#534AB7'; color = '#3C3489' }
            return (
              <button key={opt} onClick={() => !revealed && setSelected(opt)} style={{
                padding: '12px 14px', borderRadius: '14px', fontSize: '14px', fontWeight: 500,
                border: `2px solid ${border}`, background: bg, color, cursor: revealed ? 'default' : 'pointer',
                textAlign: 'left', transition: 'all .15s', wordBreak: 'break-word',
              }}>
                {revealed && isThis && '✓ '}{revealed && isSelected && !isThis && '✗ '}{opt}
              </button>
            )
          })}
        </div>
      )}

      {exercise.type === 'true_false' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          {['Sant', 'Falskt'].map(opt => {
            const isThis = norm(opt) === norm(exercise.correct_answer)
            const isSelected = selected === opt
            let bg = '#F8F6F1', border = '#E5E2DC', color = '#1A1916'
            if (revealed && isThis) { bg = '#DCFCE7'; border = '#22C55E'; color = '#15803D' }
            else if (revealed && isSelected && !isThis) { bg = '#FEE2E2'; border = '#EF4444'; color = '#B91C1C' }
            else if (!revealed && isSelected) { bg = '#EEEDFE'; border = '#534AB7'; color = '#3C3489' }
            return (
              <button key={opt} onClick={() => !revealed && setSelected(opt)} style={{
                padding: '12px 14px', borderRadius: '14px', fontSize: '15px', fontWeight: 600,
                border: `2px solid ${border}`, background: bg, color, cursor: revealed ? 'default' : 'pointer',
                transition: 'all .15s',
              }}>
                {opt === 'Sant' ? '✅ ' : '❌ '}{opt}
              </button>
            )
          })}
        </div>
      )}

      {exercise.type === 'open' && (
        <textarea style={{
          width: '100%', padding: '12px 14px', border: '2px solid #E5E2DC', borderRadius: '14px',
          fontSize: '15px', outline: 'none', background: revealed ? '#F8F6F1' : '#fff',
          color: '#1A1916', fontFamily: 'var(--font-body)', resize: 'none', marginBottom: '12px',
          boxSizing: 'border-box',
        }} rows={3} value={openAnswer} onChange={e => setOpenAnswer(e.target.value)}
          placeholder="Skriv ditt svar här..." disabled={revealed} />
      )}

      {!revealed && (selected || exercise.type === 'open') && (
        <button onClick={handleReveal} style={{
          padding: '11px 22px', borderRadius: '14px', fontSize: '14px', fontWeight: 600,
          background: '#534AB7', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          Visa svar
        </button>
      )}

      {revealed && exercise.type !== 'open' && (
        <div style={{
          marginTop: '8px', padding: '11px 14px', borderRadius: '14px', fontSize: '14px', fontWeight: 600,
          background: isCorrect ? '#DCFCE7' : '#FEE2E2',
          color: isCorrect ? '#15803D' : '#B91C1C',
        }}>
          {isCorrect ? '🎉 Rätt svar!' : `Rätt svar: ${exercise.correct_answer}`}
        </div>
      )}

      {revealed && exercise.type === 'open' && (
        <>
          <div style={{ padding: '11px 14px', borderRadius: '14px', fontSize: '13px', background: '#F8F6F1', color: '#6B6860', marginBottom: '8px' }}>
            <strong>Facit:</strong> {exercise.correct_answer}
          </div>
          {!aiFeedback && (
            <button onClick={handleAskAI} disabled={loadingAI} style={{
              padding: '9px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: 500,
              background: '#EEEDFE', color: '#3C3489', border: 'none', cursor: 'pointer', marginBottom: '8px',
            }}>
              {loadingAI ? '🤔 Tänker...' : '🤖 Fråga AI om mitt svar'}
            </button>
          )}
          {aiFeedback && (
            <div style={{ padding: '11px 14px', borderRadius: '14px', background: '#EEEDFE', color: '#3C3489', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>
              🤖 {aiFeedback}
            </div>
          )}
        </>
      )}

      {revealed && (
        <div style={{ marginTop: '8px' }}>
          {!webInfo && (
            <button onClick={handleLearnMore} disabled={loadingWeb} style={{
              padding: '9px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: 500,
              background: '#FEF3C7', color: '#92400E', border: 'none', cursor: loadingWeb ? 'default' : 'pointer',
              opacity: loadingWeb ? 0.7 : 1,
            }}>
              {loadingWeb ? '🔍 Söker...' : '🌍 Ta reda på mer!'}
            </button>
          )}
          {webInfo && (
            <div style={{ padding: '11px 14px', borderRadius: '14px', background: '#FEF3C7', color: '#78350F', fontSize: '13px', lineHeight: 1.7 }}>
              🌍 {webInfo}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const PROMPT_SUFFIX = `\n\nSvara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"...","type":"multiple_choice","options":["A","B","C","D"],"correct_answer":"A","difficulty":"easy"}]

Type kan vara: multiple_choice, open, true_false
För true_false: options ska vara ["Sant","Falskt"]
För open: options ska vara null`

function buildClaudeContent(material, count, harder = false) {
  const isMath = material.content?.startsWith('__MATH__:')
  const isPdf = material.content?.startsWith('__PDF_BASE64__:')
  const difficultyNote = harder ? '\n- Fokusera på svåra och komplexa frågor. Inga enkla frågor.' : ''

  if (isMath) {
    const topic = material.content.slice('__MATH__:'.length)
    const hardNote = harder ? '\n- Fokusera på svåra flerstegsproblem och komplexa beräkningar.' : ''
    return `Skapa ${count} matematikuppgifter på svenska för en elev som ska öva på: ${topic}

Regler:
- Skapa verkliga beräkningsuppgifter med specifika tal, inte frågor om teorin
- Blanda svårighetsgrad från lätt till svår${hardNote}
- Använd "multiple_choice" för kortare beräkningar (ge 4 rimliga svarsalternativ där ett är rätt)
- Använd "open" för flerstegsproblem eller textuppgifter
- correct_answer ska alltid vara det exakta svaret (t.ex. "312" eller "3/4")

Svara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"Beräkna: 24 × 13 =","type":"multiple_choice","options":["312","252","324","288"],"correct_answer":"312","difficulty":"medium"}]`
  }

  if (isPdf) {
    const pdfPrompt = `Läs igenom hela PDF-dokumentet noggrant från början till slut, inklusive alla fördjupningsavsnitt, faktarutor och extrainfo som finns.

Skapa ${count} övningsfrågor på svenska baserat på HELA innehållet i dokumentet. Ämne: ${material.subject}.
${harder ? '- Fokusera på svåra och komplexa frågor, gärna från fördjupningsavsnitten.' : '- Blanda enkla och svåra frågor från hela dokumentet.'}
- Inkludera frågor från både grundinnehållet och eventuella fördjupningsdelar.${PROMPT_SUFFIX}`
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: material.content.slice('__PDF_BASE64__:'.length) } },
      { type: 'text', text: pdfPrompt },
    ]
  }

  const prompt = `Skapa ${count} övningsfrågor på svenska för ämnet: ${material.subject}.${difficultyNote}${PROMPT_SUFFIX}`
  return `Skapa ${count} övningsfrågor på svenska för följande läxmaterial.\nÄmne: ${material.subject}\nMaterial: ${material.content}${difficultyNote}${PROMPT_SUFFIX}`
}

function calcStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0
  const days = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (days[0] !== today && days[0] !== yesterday) return 0
  let streak = 0
  let current = days[0]
  for (const day of days) {
    if (day === current) {
      streak++
      const d = new Date(current)
      d.setDate(d.getDate() - 1)
      current = d.toISOString().slice(0, 10)
    } else break
  }
  return streak
}

export default function KidsHomework() {
  const { childId } = useParams()
  const navigate = useNavigate()
  const { childUser, logoutChild } = useChildAuth()

  const [materials, setMaterials] = useState([])
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [exercises, setExercises] = useState([])
  const [generating, setGenerating] = useState(false)
  const [loadingExercises, setLoadingExercises] = useState(false)
  const [questionCount, setQuestionCount] = useState(15)
  const [score, setScore] = useState({ correct: 0, answered: 0, open: 0 })
  const [streak, setStreak] = useState(0)
  const sessionSaved = useRef(false)

  useEffect(() => { fetchMaterials(); fetchStreak() }, [childId])

  // Save session when all exercises answered
  useEffect(() => {
    if (exercises.length > 0 && score.answered === exercises.length && !sessionSaved.current) {
      sessionSaved.current = true
      saveSession(score.correct, exercises.length)
    }
  }, [score.answered, exercises.length])

  async function fetchMaterials() {
    const { data } = await supabase.from('materials').select('*').eq('child_id', childId).order('due_date', { ascending: true, nullsFirst: false })
    setMaterials(data ?? [])
  }

  async function fetchStreak() {
    const { data } = await supabase
      .from('exercise_sessions')
      .select('created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
    setStreak(calcStreak(data))
  }

  async function saveSession(correct, total) {
    await supabase.from('exercise_sessions').insert({
      child_id: childId,
      material_id: selectedMaterial?.id,
      score: correct,
      total,
    })
    fetchStreak()
  }

  async function markComplete(materialId) {
    await supabase.from('materials').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', materialId)
    fetchMaterials()
  }

  async function fetchExercises(matId) {
    setLoadingExercises(true)
    setScore({ correct: 0, answered: 0, open: 0 })
    sessionSaved.current = false
    const { data } = await supabase.from('exercises').select('*').eq('material_id', matId)
    setExercises(data ?? [])
    setLoadingExercises(false)
  }

  function handleAnswer(isCorrect) {
    setScore(s => ({
      correct: s.correct + (isCorrect === true ? 1 : 0),
      answered: s.answered + 1,
      open: s.open + (isCorrect === null ? 1 : 0),
    }))
  }

  async function generateExercises(harder = false) {
    if (!selectedMaterial) return
    setGenerating(true)
    setScore({ correct: 0, answered: 0, open: 0 })
    sessionSaved.current = false
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: buildClaudeContent(selectedMaterial, questionCount, harder) }],
        }),
      })
      const data = await response.json()
      const raw = data.content[0].text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(raw)
      const toInsert = parsed.map(ex => ({ ...ex, material_id: selectedMaterial.id, child_id: childId }))
      await supabase.from('exercises').delete().eq('material_id', selectedMaterial.id)
      await supabase.from('exercises').insert(toInsert)
      fetchExercises(selectedMaterial.id)
    } catch (err) {
      console.error('Generate error:', err)
      alert('Något gick fel: ' + err.message)
    }
    setGenerating(false)
  }

  function handleLogout() {
    logoutChild()
    navigate('/kids')
  }

  function selectMaterial(m) {
    setSelectedMaterial(m)
    fetchExercises(m.id)
    setTimeout(() => {
      document.getElementById('exercises-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const allDone = exercises.length > 0 && score.answered === exercises.length
  const gradedTotal = exercises.length - score.open
  const perfectScore = gradedTotal > 0 && score.correct === gradedTotal
  const goodScore = gradedTotal > 0 && score.correct / gradedTotal >= 0.8

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEF8', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #534AB7 0%, #7C6FD4 100%)', padding: '1.25rem 1rem 3rem', color: '#fff' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '13px', opacity: 0.75, marginBottom: '2px' }}>Hej!</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 400, margin: 0 }}>
              {childUser?.name} ✨
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.2)', borderRadius: '14px', padding: '8px 14px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>🔥 {streak}</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>{streak === 1 ? 'dag' : 'dagar'} i rad</div>
              </div>
            )}
            {selectedMaterial && exercises.length > 0 && (
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.2)', borderRadius: '14px', padding: '8px 14px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{score.correct}/{exercises.length - score.open}</div>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>{score.open > 0 ? `rätt · ${score.open} öppna` : 'rätt'}</div>
              </div>
            )}
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Byt
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '-1.5rem auto 0', padding: '0 1rem 3rem' }}>

        {/* Homework cards */}
        <div style={{ marginBottom: '1.5rem' }}>
          {materials.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', textAlign: 'center', color: '#9E9B94' }}>
              Inga läxor ännu!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {materials.map((m, i) => {
                const color = CARD_COLORS[i % CARD_COLORS.length]
                const isSelected = selectedMaterial?.id === m.id
                return (
                  <div key={m.id} onClick={() => selectMaterial(m)} style={{
                    background: isSelected ? color : '#fff',
                    borderRadius: '20px',
                    padding: '1rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 4px 20px ${color}44` : '0 2px 8px rgba(0,0,0,0.06)',
                    border: `2px solid ${isSelected ? color : 'transparent'}`,
                    transition: 'all .2s',
                    position: 'relative',
                  }}>
                    {m.completed && (
                      <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '14px' }}>✅</span>
                    )}
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>{getEmoji(m.subject)}</div>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? '#fff' : '#1A1916', margin: 0 }}>{m.subject}</p>
                    {m.due_date && (
                      <p style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.75)' : '#9E9B94', margin: '3px 0 0' }}>
                        {new Date(m.due_date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Exercises section */}
        {selectedMaterial && (
          <div id="exercises-section">
            {/* Section header */}
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1rem', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px' }}>{getEmoji(selectedMaterial.subject)}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{selectedMaterial.subject}</p>
                    {exercises.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#9E9B94', margin: 0 }}>{exercises.length} övningar</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {[5, 10, 15, 20].map(n => (
                    <button key={n} onClick={() => setQuestionCount(n)} style={{
                      padding: '4px 10px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      background: questionCount === n ? '#534AB7' : '#F0EEF8',
                      color: questionCount === n ? '#fff' : '#6B6860',
                    }}>{n}</button>
                  ))}
                  <button onClick={() => generateExercises(false)} disabled={generating} style={{
                    padding: '7px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 600,
                    background: '#534AB7', color: '#fff', cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.7 : 1,
                  }}>
                    {generating ? '⏳ Genererar...' : exercises.length === 0 ? '✨ Generera frågor' : '🔄 Nya frågor'}
                  </button>
                  {exercises.length > 0 && (
                    <button onClick={() => generateExercises(true)} disabled={generating} style={{
                      padding: '7px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 600,
                      background: 'linear-gradient(135deg, #D85A30, #D4537E)', color: '#fff', cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.7 : 1,
                    }}>
                      🔥 Svårare frågor
                    </button>
                  )}
                </div>
              </div>

              {/* Mark complete button */}
              {!selectedMaterial.completed && (
                <button onClick={() => markComplete(selectedMaterial.id)} style={{
                  width: '100%', padding: '9px', borderRadius: '14px', border: '1.5px dashed #22C55E',
                  background: 'transparent', color: '#15803D', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>
                  ✅ Markera läxa som inlämnad
                </button>
              )}
              {selectedMaterial.completed && (
                <div style={{ padding: '9px', borderRadius: '14px', background: '#DCFCE7', color: '#15803D', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                  ✅ Läxa inlämnad!
                </div>
              )}
            </div>

            {/* Progress bar — always visible when exercises loaded */}
            {exercises.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '10px 14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9E9B94', marginBottom: '5px' }}>
                  <span>Framsteg</span>
                  <span>{score.answered} av {exercises.length} besvarade · {score.correct} rätt{score.open > 0 ? ` · ${score.open} öppna` : ''}</span>
                </div>
                <div style={{ height: '8px', background: '#F0EEF8', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(score.answered / exercises.length) * 100}%`, background: 'linear-gradient(90deg, #534AB7, #7C6FD4)', borderRadius: '4px', transition: 'width .3s' }} />
                </div>
              </div>
            )}

            {loadingExercises ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9E9B94', background: '#fff', borderRadius: '20px' }}>
                Hämtar övningar...
              </div>
            ) : exercises.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '20px' }}>
                <p style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</p>
                <p style={{ color: '#9E9B94', fontSize: '14px' }}>Klicka "Generera" för att skapa övningar!</p>
              </div>
            ) : (
              exercises.map((ex, i) => (
                <ExerciseItem key={ex.id} exercise={ex} index={i} total={exercises.length} onAnswer={handleAnswer} subject={selectedMaterial.subject} />
              ))
            )}

            {/* Results screen */}
            {allDone && (
              <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: '#fff', borderRadius: '20px', marginTop: '12px' }}>
                <p style={{ fontSize: '48px', marginBottom: '8px' }}>
                  {perfectScore ? '🏆' : goodScore ? '🌟' : '💪'}
                </p>
                <p style={{ fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>
                  {score.correct} av {gradedTotal} rätt{score.open > 0 ? ` · ${score.open} öppna` : ''}!
                </p>
                <p style={{ color: '#9E9B94', fontSize: '14px', marginBottom: '1.25rem' }}>
                  {perfectScore ? 'Perfekt! Fantastiskt jobbat!' : goodScore ? 'Bra jobbat! Du kan detta!' : 'Bra försök! Öva lite till!'}
                </p>
                {goodScore && (
                  <button onClick={() => generateExercises(true)} disabled={generating} style={{
                    padding: '11px 22px', borderRadius: '14px', border: 'none', fontSize: '14px', fontWeight: 600,
                    background: 'linear-gradient(135deg, #D85A30, #D4537E)', color: '#fff', cursor: 'pointer',
                    marginBottom: '8px', display: 'block', width: '100%',
                  }}>
                    {generating ? '⏳ Genererar...' : '🔥 Prova svårare frågor!'}
                  </button>
                )}
                <button onClick={() => generateExercises(false)} disabled={generating} style={{
                  padding: '11px 22px', borderRadius: '14px', border: '1.5px solid #E5E2DC', fontSize: '14px', fontWeight: 600,
                  background: 'transparent', color: '#534AB7', cursor: 'pointer', display: 'block', width: '100%',
                }}>
                  🔄 Öva igen
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
