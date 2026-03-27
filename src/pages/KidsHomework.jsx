import { useState, useEffect } from 'react'
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

function ExerciseItem({ exercise, index, total, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [openAnswer, setOpenAnswer] = useState('')
  const [aiFeedback, setAiFeedback] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)

  const isCorrect = (exercise.type === 'multiple_choice' || exercise.type === 'true_false')
    ? norm(selected) === norm(exercise.correct_answer)
    : null

  function handleReveal() {
    setRevealed(true)
    if (isCorrect !== null) onAnswer(isCorrect)
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
      padding: '1.5rem',
      marginBottom: '12px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: revealed
        ? isCorrect === true ? '2px solid #22C55E'
        : isCorrect === false ? '2px solid #EF4444'
        : '2px solid transparent'
        : '2px solid transparent',
      transition: 'border-color .3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9E9B94', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Fråga {index + 1} av {total}
        </span>
        {revealed && isCorrect === true && <span style={{ fontSize: '20px' }}>⭐</span>}
        {revealed && isCorrect === false && <span style={{ fontSize: '20px' }}>💪</span>}
      </div>

      <p style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.5, marginBottom: '1.25rem', color: '#1A1916' }}>
        {exercise.question}
      </p>

      {exercise.type === 'multiple_choice' && exercise.options && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
          {exercise.options.map(opt => {
            const isThis = norm(opt) === norm(exercise.correct_answer)
            const isSelected = selected === opt
            let bg = '#F8F6F1', border = '#E5E2DC', color = '#1A1916'
            if (revealed && isThis) { bg = '#DCFCE7'; border = '#22C55E'; color = '#15803D' }
            else if (revealed && isSelected && !isThis) { bg = '#FEE2E2'; border = '#EF4444'; color = '#B91C1C' }
            else if (!revealed && isSelected) { bg = '#EEEDFE'; border = '#534AB7'; color = '#3C3489' }
            return (
              <button key={opt} onClick={() => !revealed && setSelected(opt)} style={{
                padding: '14px 16px', borderRadius: '14px', fontSize: '15px', fontWeight: 500,
                border: `2px solid ${border}`, background: bg, color, cursor: revealed ? 'default' : 'pointer',
                textAlign: 'left', transition: 'all .15s',
              }}>
                {revealed && isThis && '✓ '}{revealed && isSelected && !isThis && '✗ '}{opt}
              </button>
            )
          })}
        </div>
      )}

      {exercise.type === 'true_false' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
          {['Sant', 'Falskt'].map(opt => {
            const isThis = norm(opt) === norm(exercise.correct_answer)
            const isSelected = selected === opt
            let bg = '#F8F6F1', border = '#E5E2DC', color = '#1A1916'
            if (revealed && isThis) { bg = '#DCFCE7'; border = '#22C55E'; color = '#15803D' }
            else if (revealed && isSelected && !isThis) { bg = '#FEE2E2'; border = '#EF4444'; color = '#B91C1C' }
            else if (!revealed && isSelected) { bg = '#EEEDFE'; border = '#534AB7'; color = '#3C3489' }
            return (
              <button key={opt} onClick={() => !revealed && setSelected(opt)} style={{
                padding: '14px 16px', borderRadius: '14px', fontSize: '16px', fontWeight: 600,
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
        }} rows={3} value={openAnswer} onChange={e => setOpenAnswer(e.target.value)}
          placeholder="Skriv ditt svar här..." disabled={revealed} />
      )}

      {!revealed && (selected || exercise.type === 'open') && (
        <button onClick={handleReveal} style={{
          padding: '12px 24px', borderRadius: '14px', fontSize: '15px', fontWeight: 600,
          background: '#534AB7', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          Visa svar
        </button>
      )}

      {revealed && exercise.type !== 'open' && (
        <div style={{
          marginTop: '8px', padding: '12px 16px', borderRadius: '14px', fontSize: '15px', fontWeight: 600,
          background: isCorrect ? '#DCFCE7' : '#FEE2E2',
          color: isCorrect ? '#15803D' : '#B91C1C',
        }}>
          {isCorrect ? '🎉 Rätt svar!' : `Rätt svar: ${exercise.correct_answer}`}
        </div>
      )}

      {revealed && exercise.type === 'open' && (
        <>
          <div style={{ padding: '12px 16px', borderRadius: '14px', fontSize: '14px', background: '#F8F6F1', color: '#6B6860', marginBottom: '8px' }}>
            <strong>Facit:</strong> {exercise.correct_answer}
          </div>
          {!aiFeedback && (
            <button onClick={handleAskAI} disabled={loadingAI} style={{
              padding: '10px 18px', borderRadius: '14px', fontSize: '13px', fontWeight: 500,
              background: '#EEEDFE', color: '#3C3489', border: 'none', cursor: 'pointer',
            }}>
              {loadingAI ? '🤔 Tänker...' : '🤖 Fråga AI om mitt svar'}
            </button>
          )}
          {aiFeedback && (
            <div style={{ padding: '12px 16px', borderRadius: '14px', background: '#EEEDFE', color: '#3C3489', fontSize: '14px', lineHeight: 1.6 }}>
              🤖 {aiFeedback}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const PROMPT_SUFFIX = `\n\nSvara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"...","type":"multiple_choice","options":["A","B","C","D"],"correct_answer":"A","difficulty":"easy"}]

Type kan vara: multiple_choice, open, true_false
För true_false: options ska vara ["Sant","Falskt"]
För open: options ska vara null`

function buildClaudeContent(material, count) {
  const isMath = material.content?.startsWith('__MATH__:')
  const isPdf = material.content?.startsWith('__PDF_BASE64__:')

  if (isMath) {
    const topic = material.content.slice('__MATH__:'.length)
    return `Skapa ${count} matematikuppgifter på svenska för en elev som ska öva på: ${topic}

Regler:
- Skapa verkliga beräkningsuppgifter med specifika tal, inte frågor om teorin
- Blanda svårighetsgrad från lätt till svår
- Använd "multiple_choice" för kortare beräkningar (ge 4 rimliga svarsalternativ där ett är rätt)
- Använd "open" för flerstegsproblem eller textuppgifter
- correct_answer ska alltid vara det exakta svaret (t.ex. "312" eller "3/4")

Svara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"Beräkna: 24 × 13 =","type":"multiple_choice","options":["312","252","324","288"],"correct_answer":"312","difficulty":"medium"}]`
  }

  const prompt = `Skapa ${count} övningsfrågor på svenska för ämnet: ${material.subject}.${PROMPT_SUFFIX}`
  if (isPdf) {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: material.content.slice('__PDF_BASE64__:'.length) } },
      { type: 'text', text: prompt },
    ]
  }
  return `Skapa ${count} övningsfrågor på svenska för följande läxmaterial.\nÄmne: ${material.subject}\nMaterial: ${material.content}${PROMPT_SUFFIX}`
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
  const [score, setScore] = useState({ correct: 0, answered: 0 })

  useEffect(() => { fetchMaterials() }, [childId])

  async function fetchMaterials() {
    const { data } = await supabase.from('materials').select('*').eq('child_id', childId).order('due_date', { ascending: true, nullsFirst: false })
    setMaterials(data ?? [])
  }

  async function fetchExercises(matId) {
    setLoadingExercises(true)
    setScore({ correct: 0, answered: 0 })
    const { data } = await supabase.from('exercises').select('*').eq('material_id', matId)
    setExercises(data ?? [])
    setLoadingExercises(false)
  }

  function handleAnswer(isCorrect) {
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), answered: s.answered + 1 }))
  }

  async function generateExercises() {
    if (!selectedMaterial) return
    setGenerating(true)
    setScore({ correct: 0, answered: 0 })
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
          messages: [{ role: 'user', content: buildClaudeContent(selectedMaterial, questionCount) }],
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

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEF8', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #534AB7 0%, #7C6FD4 100%)', padding: '1.5rem 1.5rem 3rem', color: '#fff' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '14px', opacity: 0.75, marginBottom: '2px' }}>Hej!</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, margin: 0 }}>
              {childUser?.name} ✨
            </h1>
          </div>
          {score.answered > 0 && (
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.2)', borderRadius: '16px', padding: '10px 16px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700 }}>{score.correct}/{score.answered}</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>rätt</div>
            </div>
          )}
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '12px', padding: '8px 14px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
            Byt användare
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '-1.5rem auto 0', padding: '0 1.5rem 3rem' }}>

        {/* Homework cards */}
        <div style={{ marginBottom: '1.5rem' }}>
          {materials.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '20px', padding: '2rem', textAlign: 'center', color: '#9E9B94' }}>
              Inga läxor ännu!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {materials.map((m, i) => {
                const color = CARD_COLORS[i % CARD_COLORS.length]
                const isSelected = selectedMaterial?.id === m.id
                return (
                  <div key={m.id} onClick={() => selectMaterial(m)} style={{
                    background: isSelected ? color : '#fff',
                    borderRadius: '20px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 4px 20px ${color}44` : '0 2px 8px rgba(0,0,0,0.06)',
                    border: `2px solid ${isSelected ? color : 'transparent'}`,
                    transition: 'all .2s',
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>{getEmoji(m.subject)}</div>
                    <p style={{ fontWeight: 600, fontSize: '15px', color: isSelected ? '#fff' : '#1A1916', margin: 0 }}>{m.subject}</p>
                    {m.due_date && (
                      <p style={{ fontSize: '12px', color: isSelected ? 'rgba(255,255,255,0.75)' : '#9E9B94', margin: '4px 0 0' }}>
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
            <div style={{ background: '#fff', borderRadius: '20px', padding: '1rem 1.25rem', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{getEmoji(selectedMaterial.subject)}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>{selectedMaterial.subject}</p>
                  {exercises.length > 0 && (
                    <p style={{ fontSize: '12px', color: '#9E9B94', margin: 0 }}>{exercises.length} övningar</p>
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
                <button onClick={generateExercises} disabled={generating} style={{
                  padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 600,
                  background: '#534AB7', color: '#fff', cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.7 : 1,
                }}>
                  {generating ? '⏳ Genererar...' : exercises.length === 0 ? '✨ Generera' : '🔄 Nya frågor'}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {exercises.length > 0 && score.answered > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '12px 16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9E9B94', marginBottom: '6px' }}>
                  <span>Framsteg</span>
                  <span>{score.answered} av {exercises.length} besvarade · {score.correct} rätt</span>
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
                <ExerciseItem key={ex.id} exercise={ex} index={i} total={exercises.length} onAnswer={handleAnswer} />
              ))
            )}

            {score.answered === exercises.length && exercises.length > 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '20px', marginTop: '12px' }}>
                <p style={{ fontSize: '48px', marginBottom: '8px' }}>
                  {score.correct === exercises.length ? '🏆' : score.correct >= exercises.length / 2 ? '🌟' : '💪'}
                </p>
                <p style={{ fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>
                  {score.correct} av {exercises.length} rätt!
                </p>
                <p style={{ color: '#9E9B94', fontSize: '14px' }}>
                  {score.correct === exercises.length ? 'Perfekt! Fantastiskt jobbat!' : score.correct >= exercises.length / 2 ? 'Bra jobbat! Fortsätt öva!' : 'Bra försök! Öva lite till!'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
