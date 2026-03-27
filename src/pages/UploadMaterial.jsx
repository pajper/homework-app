import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase } from '../lib/supabase'
async function pdfToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const s = {
  page: { minHeight:'100vh', background:'var(--bg)', padding:'2rem 1.5rem' },
  wrap: { maxWidth:'600px', margin:'0 auto' },
  back: { background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:'14px', cursor:'pointer', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'6px', padding:0 },
  title: { fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:300, marginBottom:'2rem' },
  card: { background:'var(--surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.5rem', marginBottom:'1rem' },
  label: { display:'block', fontSize:'13px', fontWeight:500, color:'var(--text-secondary)', marginBottom:'6px' },
  input: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'15px', marginBottom:'1.25rem', outline:'none', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'var(--font-body)' },
  textarea: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'14px', marginBottom:'1.25rem', outline:'none', background:'var(--surface)', color:'var(--text-primary)', fontFamily:'var(--font-body)', resize:'vertical', minHeight:'120px', lineHeight:1.6 },
  tabs: { display:'flex', gap:'0', marginBottom:'1.25rem', border:'0.5px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  tab: (active) => ({ flex:1, padding:'8px', border:'none', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontSize:'14px', fontWeight:'500', cursor:'pointer' }),
  dropzone: (drag) => ({ border:`1.5px dashed ${drag ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius:'var(--radius-md)', padding:'2rem', textAlign:'center', cursor:'pointer', background: drag ? 'var(--accent-light)' : 'transparent', transition:'all .15s', marginBottom:'1.25rem' }),
  dropText: { fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6 },
  fileChip: { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent-light)', color:'var(--accent-text)', borderRadius:'var(--radius-md)', padding:'6px 12px', fontSize:'13px', fontWeight:500, marginBottom:'1.25rem' },
  toggle: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.25rem', cursor:'pointer' },
  toggleTrack: (on) => ({ width:'34px', height:'20px', borderRadius:'10px', background: on ? 'var(--accent)' : 'var(--border-strong)', position:'relative', transition:'background .2s', flexShrink:0 }),
  toggleThumb: (on) => ({ position:'absolute', top:'2px', left: on ? '16px' : '2px', width:'16px', height:'16px', borderRadius:'50%', background:'#fff', transition:'left .15s' }),
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  examBox: { background:'var(--exam-light)', border:'0.5px solid var(--exam)', borderRadius:'var(--radius-md)', padding:'1rem', marginBottom:'1.25rem' },
  examTitle: { fontSize:'13px', fontWeight:500, color:'var(--exam-text)', marginBottom:'10px' },
  btn: (variant) => ({ padding:'12px 20px', borderRadius:'var(--radius-md)', fontSize:'15px', fontWeight:500, cursor:'pointer', border: variant === 'primary' ? 'none' : '0.5px solid var(--border-strong)', background: variant === 'primary' ? 'var(--accent)' : 'transparent', color: variant === 'primary' ? '#fff' : 'var(--text-primary)' }),
  actions: { display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'1.5rem' },
  error: { background:'var(--urgent-light)', color:'var(--urgent-text)', borderRadius:'var(--radius-md)', padding:'10px 12px', fontSize:'13px', marginBottom:'1rem' },
}

export default function UploadMaterial() {
  const { childId } = useParams()
  const navigate = useNavigate()

  const [inputType, setInputType] = useState('text')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [textContent, setTextContent] = useState('')
  const [file, setFile] = useState(null)
  const [dueDate, setDueDate] = useState('')
  const [isExam, setIsExam] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [examSubject, setExamSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Sparar...')
  const [error, setError] = useState(null)

  const onDrop = useCallback(accepted => { if (accepted[0]) setFile(accepted[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 })

  async function handleSubmit() {
    if (!subject.trim()) { setError('Ange ett ämne'); return }
    if (inputType === 'text' && !textContent.trim()) { setError('Lägg till läxinnehåll'); return }
    if (inputType === 'pdf' && !file) { setError('Välj en PDF-fil'); return }

    setLoading(true)
    setError(null)

    let filePath = null
    let content = textContent

    if (inputType === 'pdf' && file) {
      if (file.size > 4 * 1024 * 1024) {
        setError('PDF:en är för stor (max 4 MB). Prova att dela upp den eller kopiera texten manuellt.')
        setLoading(false)
        return
      }
      setLoadingMsg('Läser PDF...')
      try {
        const base64 = await pdfToBase64(file)
        content = `__PDF_BASE64__:${base64}`
      } catch (e) {
        setError('Kunde inte läsa PDF:en.')
        setLoading(false)
        return
      }
    }

    setLoadingMsg('Sparar...')

    const { error: insertError } = await supabase.from('materials').insert({
      child_id: childId,
      subject: subject.trim(),
      description: description.trim() || null,
      content,
      file_path: filePath,
      type: inputType,
      due_date: dueDate || null,
      is_exam: isExam,
      exam_date: isExam && examDate ? examDate : null,
      exam_subject: isExam && examSubject ? examSubject.trim() : null,
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }

    const { data: newMaterial } = await supabase
      .from('materials')
      .select('id')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (newMaterial) {
      setLoadingMsg('Genererar övningar...')
      try {
        const isPdf = content.startsWith('__PDF_BASE64__:')
        const prompt = `Skapa 15 övningsfrågor på svenska för ämnet: ${subject.trim()}.

Svara ENDAST med ett JSON-array, inga förklaringar:
[{"question":"...","type":"multiple_choice","options":["A","B","C","D"],"correct_answer":"A","difficulty":"easy"}]

Type kan vara: multiple_choice, open, true_false
För true_false: options ska vara ["Sant","Falskt"]
För open: options ska vara null`

        const messageContent = isPdf
          ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content.slice('__PDF_BASE64__:'.length) } }, { type: 'text', text: prompt }]
          : `Skapa 15 övningsfrågor på svenska för följande läxmaterial.\nÄmne: ${subject.trim()}\nMaterial: ${content}\n\n${prompt}`

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
            max_tokens: 4000,
            messages: [{ role: 'user', content: messageContent }],
          }),
        })
        const aiData = await response.json()
        const raw = aiData.content[0].text.replace(/```json|```/g, '').trim()
        const exercises = JSON.parse(raw)
        await supabase.from('exercises').insert(
          exercises.map(ex => ({ ...ex, material_id: newMaterial.id, child_id: childId }))
        )
      } catch (e) {
        console.error('Auto-generering misslyckades:', e)
        // Fortsätt ändå — övningar kan genereras manuellt
      }
    }

    navigate('/')
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <button style={s.back} onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Tillbaka
        </button>
        <h1 style={s.title}>Lägg till läxa</h1>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.card}>
          <label style={s.label}>Ämne</label>
          <input style={s.input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="t.ex. Svenska, Matematik, Engelska" />

          <label style={s.label}>Beskrivning (valfritt)</label>
          <input style={s.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="t.ex. Läs kap. 4 och svara på frågorna" />

          <label style={s.label}>Material</label>
          <div style={s.tabs}>
            <button style={s.tab(inputType==='text')} onClick={() => setInputType('text')}>Textinmatning</button>
            <button style={s.tab(inputType==='pdf')} onClick={() => setInputType('pdf')}>PDF</button>
          </div>

          {inputType === 'text' ? (
            <textarea style={s.textarea} value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Klistra in läxinnehållet här — text från boken, uppgifter, glosor, etc." />
          ) : (
            file
              ? <div style={s.fileChip}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  {file.name}
                  <button onClick={() => setFile(null)} style={{ background:'transparent', border:'none', color:'var(--accent-text)', cursor:'pointer', fontSize:'16px', lineHeight:1 }}>×</button>
                </div>
              : <div {...getRootProps()} style={s.dropzone(isDragActive)}>
                  <input {...getInputProps()} />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ margin:'0 auto 8px', display:'block', color:'var(--text-hint)' }}><path d="M12 15V3M12 3L8 7M12 3l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 15v2a4 4 0 004 4h10a4 4 0 004-4v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <p style={s.dropText}>Dra och släpp en PDF här<br/><span style={{ color:'var(--accent)' }}>eller klicka för att välja</span></p>
                </div>
          )}
        </div>

        <div style={s.card}>
          <label style={s.label}>Datum</label>
          <div style={s.row}>
            <div>
              <label style={{ ...s.label, marginBottom:'4px' }}>Inlämningsdatum</label>
              <input style={{ ...s.input, marginBottom:0 }} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div style={{ ...s.toggle, marginTop:'1.25rem' }} onClick={() => setIsExam(!isExam)}>
            <div style={s.toggleTrack(isExam)}>
              <div style={s.toggleThumb(isExam)} />
            </div>
            <span style={{ fontSize:'14px', color:'var(--text-primary)', userSelect:'none' }}>Kopplat till ett prov</span>
          </div>

          {isExam && (
            <div style={s.examBox}>
              <p style={s.examTitle}>Provdetaljer</p>
              <div style={s.row}>
                <div>
                  <label style={{ ...s.label, marginBottom:'4px' }}>Provdatum</label>
                  <input style={{ ...s.input, marginBottom:0, background:'var(--surface)' }} type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ ...s.label, marginBottom:'4px' }}>Provnamn</label>
                  <input style={{ ...s.input, marginBottom:0, background:'var(--surface)' }} value={examSubject} onChange={e => setExamSubject(e.target.value)} placeholder="t.ex. Matteprov kap. 3" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={s.actions}>
          <button style={s.btn()} onClick={() => navigate('/')}>Avbryt</button>
          <button style={s.btn('primary')} onClick={handleSubmit} disabled={loading}>
            {loading ? loadingMsg : 'Spara läxa'}
          </button>
        </div>
      </div>
    </div>
  )
}
