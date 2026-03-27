import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import HomeworkCard from '../components/HomeworkCard'

const s = {
  page: { minHeight:'100vh', background:'var(--bg)', padding:'2rem 1.5rem' },
  wrap: { maxWidth:'700px', margin:'0 auto' },
  back: { background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:'14px', cursor:'pointer', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'6px', padding:0 },
  title: { fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:300, marginBottom:'2rem' },
  sectionTitle: { fontSize:'13px', fontWeight:500, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'2rem 0 12px' },
  exerciseCard: { background:'var(--surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:'10px' },
  question: { fontSize:'15px', fontWeight:500, marginBottom:'1rem', lineHeight:1.5 },
  options: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'1rem' },
  option: (selected, correct, revealed) => ({
    padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:'14px', cursor: revealed ? 'default' : 'pointer', border:'0.5px solid',
    borderColor: !selected && !revealed ? 'var(--border-strong)'
      : revealed && correct ? 'var(--ok)'
      : revealed && selected && !correct ? 'var(--urgent)'
      : 'var(--border-strong)',
    background: !selected && !revealed ? 'transparent'
      : revealed && correct ? 'var(--ok-light)'
      : revealed && selected && !correct ? 'var(--urgent-light)'
      : selected ? 'var(--accent-light)' : 'transparent',
    color: revealed && correct ? 'var(--ok-text)'
      : revealed && selected && !correct ? 'var(--urgent-text)'
      : 'var(--text-primary)',
    transition:'all .15s',
  }),
  openInput: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'14px', outline:'none', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'var(--font-body)', resize:'none' },
  revealBtn: { padding:'8px 16px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'13px', background:'transparent', cursor:'pointer', color:'var(--text-secondary)' },
  answer: (correct) => ({ marginTop:'10px', padding:'10px 12px', borderRadius:'var(--radius-md)', fontSize:'13px', background: correct ? 'var(--ok-light)' : 'var(--exam-light)', color: correct ? 'var(--ok-text)' : 'var(--exam-text)' }),
  genBtn: { padding:'12px 24px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', fontSize:'15px', fontWeight:500, cursor:'pointer' },
  genWrap: { textAlign:'center', padding:'2rem', background:'var(--surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)' },
  genSub: { fontSize:'14px', color:'var(--text-secondary)', marginBottom:'1.5rem' },
  badge: { display:'inline-block', fontSize:'11px', fontWeight:500, padding:'2px 8px', borderRadius:'20px', background:'var(--accent-light)', color:'var(--accent-text)', marginLeft:'8px', verticalAlign:'middle' },
  loading: { textAlign:'center', padding:'3rem', color:'var(--text-secondary)' },
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

function ExerciseItem({ exercise }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [openAnswer, setOpenAnswer] = useState('')
  const [aiFeedback, setAiFeedback] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)

  const isCorrect = (exercise.type === 'multiple_choice' || exercise.type === 'true_false')
    ? norm(selected) === norm(exercise.correct_answer)
    : null

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
    <div style={s.exerciseCard}>
      <p style={s.question}>{exercise.question}</p>

      {exercise.type === 'multiple_choice' && exercise.options && (
        <div style={s.options}>
          {exercise.options.map(opt => (
            <button key={opt}
              style={s.option(selected === opt, norm(opt) === norm(exercise.correct_answer), revealed)}
              onClick={() => !revealed && setSelected(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {exercise.type === 'true_false' && (
        <div style={{ ...s.options, gridTemplateColumns:'1fr 1fr', maxWidth:'240px' }}>
          {['Sant', 'Falskt'].map(opt => (
            <button key={opt}
              style={s.option(selected === opt, norm(opt) === norm(exercise.correct_answer), revealed)}
              onClick={() => !revealed && setSelected(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {exercise.type === 'open' && (
        <textarea
          style={s.openInput}
          rows={3}
          value={openAnswer}
          onChange={e => setOpenAnswer(e.target.value)}
          placeholder="Skriv ditt svar här..."
          disabled={revealed}
        />
      )}

      {!revealed && (selected || exercise.type === 'open') && (
        <button style={s.revealBtn} onClick={() => setRevealed(true)}>Visa svar</button>
      )}

      {revealed && exercise.type !== 'open' && (
        <div style={s.answer(isCorrect)}>
          {isCorrect ? '✓ Rätt!' : `✗ Rätt svar: ${exercise.correct_answer}`}
        </div>
      )}

      {revealed && exercise.type === 'open' && (
        <>
          <div style={s.answer(null)}>Facit: {exercise.correct_answer}</div>
          {!aiFeedback && (
            <button onClick={handleAskAI} disabled={loadingAI} style={{ ...s.revealBtn, marginTop:'8px', fontSize:'12px' }}>
              {loadingAI ? 'Frågar AI...' : 'Fråga AI om mitt svar'}
            </button>
          )}
          {aiFeedback && (
            <div style={{ marginTop:'8px', padding:'10px 12px', borderRadius:'var(--radius-md)', background:'var(--accent-light)', color:'var(--accent-text)', fontSize:'13px', lineHeight:1.6 }}>
              {aiFeedback}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ChildView() {
  const { childId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const materialId = searchParams.get('material')

  const [child, setChild] = useState(null)
  const [materials, setMaterials] = useState([])
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [exercises, setExercises] = useState([])
  const [generating, setGenerating] = useState(false)
  const [loadingExercises, setLoadingExercises] = useState(false)
  const [questionCount, setQuestionCount] = useState(15)

  useEffect(() => {
    fetchChild()
    fetchMaterials()
  }, [childId])

  useEffect(() => {
    if (materialId && materials.length > 0) {
      const m = materials.find(m => m.id === materialId)
      if (m) { setSelectedMaterial(m); fetchExercises(m.id) }
    }
  }, [materialId, materials])

  async function fetchChild() {
    const { data } = await supabase.from('profiles').select('*').eq('id', childId).single()
    setChild(data)
  }

  async function fetchMaterials() {
    const { data } = await supabase.from('materials').select('*').eq('child_id', childId).order('due_date', { ascending: true, nullsFirst: false })
    setMaterials(data ?? [])
  }

  async function fetchExercises(matId) {
    setLoadingExercises(true)
    const { data } = await supabase.from('exercises').select('*').eq('material_id', matId)
    setExercises(data ?? [])
    setLoadingExercises(false)
  }

const PROMPT_SUFFIX = `\n\nSvara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"...","type":"multiple_choice","options":["A","B","C","D"],"correct_answer":"A","difficulty":"easy"}]

Type kan vara: multiple_choice, open, true_false
För true_false: options ska vara ["Sant","Falskt"]
För open: options ska vara null`

function buildClaudeContent(material, count) {
  const isPdf = material.content?.startsWith('__PDF_BASE64__:')
  const prompt = `Skapa ${count} övningsfrågor på svenska för ämnet: ${material.subject}.${PROMPT_SUFFIX}`
  if (isPdf) {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: material.content.slice('__PDF_BASE64__:'.length) } },
      { type: 'text', text: prompt },
    ]
  }
  return `Skapa ${count} övningsfrågor på svenska för följande läxmaterial.\nÄmne: ${material.subject}\nMaterial: ${material.content}${PROMPT_SUFFIX}`
}

async function generateExercises() {
  if (!selectedMaterial) return
  setGenerating(true)

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
        messages: [{
          role: 'user',
          content: buildClaudeContent(selectedMaterial, questionCount),
        }],
      }),
    })

    const data = await response.json()
    console.log('API svar:', JSON.stringify(data))
    const raw = data.content[0].text.replace(/```json|```/g, '').trim()
    const exercises = JSON.parse(raw)

    const toInsert = exercises.map(ex => ({
      ...ex,
      material_id: selectedMaterial.id,
      child_id: childId,
    }))

    await supabase.from('exercises').delete().eq('material_id', selectedMaterial.id)
    await supabase.from('exercises').insert(toInsert)
    fetchExercises(selectedMaterial.id)
  } catch (err) {
    console.error('Generate error:', err)
    alert('Något gick fel: ' + err.message)
  }

  setGenerating(false)
}

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <button style={s.back} onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Tillbaka
        </button>

        <h1 style={s.title}>{child?.name ?? 'Barn'}</h1>

        <p style={s.sectionTitle}>Välj en läxa</p>
        {materials.map(m => (
          <div key={m.id} style={{ marginBottom:'8px' }} onClick={() => { setSelectedMaterial(m); fetchExercises(m.id) }}>
            <HomeworkCard material={m} />
          </div>
        ))}

        {selectedMaterial && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', margin:'2rem 0 12px' }}>
              <p style={{ ...s.sectionTitle, margin:0 }}>
                Övningar för {selectedMaterial.subject}
                {exercises.length > 0 && <span style={s.badge}>{exercises.length} st</span>}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                {[5, 10, 15, 20].map(n => (
                  <button key={n} onClick={() => setQuestionCount(n)} style={{ padding:'4px 10px', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-strong)', background: questionCount === n ? 'var(--accent)' : 'transparent', color: questionCount === n ? '#fff' : 'var(--text-secondary)', fontSize:'12px', cursor:'pointer' }}>{n}</button>
                ))}
                <button style={s.revealBtn} onClick={generateExercises} disabled={generating}>
                  {generating ? 'Genererar...' : exercises.length === 0 ? 'Generera övningar' : 'Generera nya'}
                </button>
              </div>
            </div>

            {loadingExercises ? (
              <div style={s.loading}>Hämtar övningar...</div>
            ) : exercises.length === 0 ? (
              <div style={s.genWrap}>
                <p style={s.genSub}>Inga övningar ännu — klicka "Generera övningar" ovan!</p>
              </div>
            ) : (
              exercises.map(ex => <ExerciseItem key={ex.id} exercise={ex} />)
            )}
          </>
        )}
      </div>
    </div>
  )
}
