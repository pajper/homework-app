import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HomeworkCard from '../components/HomeworkCard'

const AVATAR_COLORS = ['#534AB7','#1D9E75','#D85A30','#D4537E','#378ADD','#BA7517']

const s = {
  page: { minHeight:'100vh', background:'var(--bg)', padding:'2rem 1.5rem' },
  header: { maxWidth:'800px', margin:'0 auto 2rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' },
  title: { fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:300, color:'var(--text-primary)' },
  sub: { fontSize:'14px', color:'var(--text-secondary)', marginTop:'2px' },
  main: { maxWidth:'800px', margin:'0 auto' },
  sectionTitle: { fontSize:'13px', fontWeight:500, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 12px' },
  childGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'12px', marginBottom:'2.5rem' },
  childCard: (active, color) => ({ background: active ? color : 'var(--surface)', border: active ? `1.5px solid ${color}` : '0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', cursor:'pointer', transition:'all .15s' }),
  avatar: (color) => ({ width:'44px', height:'44px', borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:500, fontSize:'16px', marginBottom:'10px' }),
  childName: (active) => ({ fontWeight:500, fontSize:'15px', color: active ? '#fff' : 'var(--text-primary)', margin:0 }),
  childSub: (active) => ({ fontSize:'12px', color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)', margin:'2px 0 0' }),
  addChild: { background:'transparent', border:'0.5px dashed var(--border-strong)', borderRadius:'var(--radius-lg)', padding:'1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', color:'var(--text-secondary)', fontSize:'14px' },
  btn: (variant) => ({
    padding:'8px 16px', borderRadius:'var(--radius-md)', fontSize:'14px', fontWeight:500, cursor:'pointer',
    border: variant === 'primary' ? 'none' : '0.5px solid var(--border-strong)',
    background: variant === 'primary' ? 'var(--accent)' : 'transparent',
    color: variant === 'primary' ? '#fff' : 'var(--text-primary)',
  }),
  signout: { background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:'14px', cursor:'pointer', padding:'8px' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'1rem' },
  modalCard: { background:'var(--surface)', borderRadius:'var(--radius-xl)', padding:'2rem', width:'100%', maxWidth:'380px' },
  input: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'15px', marginBottom:'1rem', outline:'none', background:'var(--surface)', color:'var(--text-primary)' },
  label: { display:'block', fontSize:'13px', color:'var(--text-secondary)', marginBottom:'6px', fontWeight:500 },
  colorPicker: { display:'flex', gap:'8px', marginBottom:'1.5rem', flexWrap:'wrap' },
  colorDot: (color, selected) => ({ width:'28px', height:'28px', borderRadius:'50%', background:color, cursor:'pointer', border: selected ? `2px solid var(--text-primary)` : '2px solid transparent', transition:'border .1s' }),
  modalActions: { display:'flex', gap:'8px', justifyContent:'flex-end' },
  empty: { textAlign:'center', padding:'3rem 1rem', color:'var(--text-secondary)', fontSize:'14px' },
}

export default function ParentDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [materials, setMaterials] = useState([])
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildColor, setNewChildColor] = useState(AVATAR_COLORS[0])
  const [loading, setLoading] = useState(true)
  const [pinChild, setPinChild] = useState(null)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  useEffect(() => { fetchChildren() }, [])
  useEffect(() => { if (selectedChild) fetchMaterials(selectedChild.id) }, [selectedChild])

  async function fetchChildren() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'child').order('created_at')
    setChildren(data ?? [])
    if (data?.length > 0 && !selectedChild) setSelectedChild(data[0])
    setLoading(false)
  }

  async function fetchMaterials(childId) {
    const { data } = await supabase.from('materials').select('*').eq('child_id', childId).order('due_date', { ascending: true, nullsFirst: false })
    setMaterials(data ?? [])
  }

  async function addChild() {
  if (!newChildName.trim()) return
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: crypto.randomUUID(),
      name: newChildName.trim(),
      role: 'child',
      parent_id: user.id,
      avatar_color: newChildColor,
    })
    .select()
    .single()

  if (error) { console.error(error); return }
  setShowAddChild(false)
  setNewChildName('')
  fetchChildren()
}

  async function deleteMaterial(id) {
    if (!confirm('Ta bort detta material?')) return
    await supabase.from('materials').delete().eq('id', id)
    fetchMaterials(selectedChild.id)
  }

  async function generateExercises(material) {
    navigate(`/child/${material.child_id}?material=${material.id}`)
  }

  async function savePin() {
    if (pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) return
    setPinSaving(true)
    const { error } = await supabase.from('profiles').update({ pin: pinValue }).eq('id', pinChild.id)
    if (error) { console.error('PIN-sparning misslyckades:', error); alert('Kunde inte spara PIN: ' + error.message); setPinSaving(false); return }
    setPinSaving(false)
    setPinChild(null)
    setPinValue('')
    fetchChildren()
  }

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Läxhjälpen</h1>
          <p style={s.sub}>Hej {profile?.name} — välkommen tillbaka</p>
        </div>
        <button onClick={signOut} style={s.signout}>Logga ut</button>
      </div>

      <div style={s.main}>
        <p style={s.sectionTitle}>Barn</p>
        <div style={s.childGrid}>
          {children.map(child => (
            <div key={child.id} style={s.childCard(selectedChild?.id === child.id, child.avatar_color)} onClick={() => setSelectedChild(child)}>
              <div style={s.avatar(child.avatar_color)}>{initials(child.name)}</div>
              <p style={s.childName(selectedChild?.id === child.id)}>{child.name}</p>
              <p style={s.childSub(selectedChild?.id === child.id)}>{materials.filter(m => m.child_id === child.id).length} läxor</p>
              <button
                style={{ marginTop:'8px', background:'transparent', border:'0.5px solid rgba(255,255,255,0.4)', borderRadius:'var(--radius-md)', padding:'4px 10px', fontSize:'12px', cursor:'pointer', color: selectedChild?.id === child.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}
                onClick={e => { e.stopPropagation(); setPinChild(child); setPinValue(child.pin ?? '') }}
              >
                {child.pin ? '🔒 PIN' : 'Sätt PIN'}
              </button>
            </div>
          ))}
          <button style={s.addChild} onClick={() => setShowAddChild(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Lägg till barn
          </button>
        </div>

        {selectedChild && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={s.sectionTitle}>{selectedChild.name}s läxor</p>
              <button style={s.btn('primary')} onClick={() => navigate(`/upload/${selectedChild.id}`)}>
                + Lägg till läxa
              </button>
            </div>

            {materials.length === 0
              ? <div style={s.empty}>Inga läxor ännu — lägg till den första!</div>
              : materials.map(m => (
                  <HomeworkCard
                    key={m.id}
                    material={m}
                    onDelete={deleteMaterial}
                    onGenerate={generateExercises}
                  />
                ))
            }
          </>
        )}

        {!selectedChild && !loading && (
          <div style={s.empty}>Lägg till ett barn för att komma igång</div>
        )}
      </div>

      {pinChild && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && (setPinChild(null), setPinValue(''))}>
          <div style={s.modalCard}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:'1.5rem', marginBottom:'0.5rem' }}>PIN för {pinChild.name}</h2>
            <p style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'1.5rem' }}>Barnet skriver in denna kod för att logga in på /kids</p>
            <label style={s.label}>4-siffrig PIN</label>
            <input
              style={{ ...s.input, letterSpacing:'0.3em', fontSize:'22px', textAlign:'center' }}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              autoFocus
            />
            <div style={s.modalActions}>
              <button style={s.btn()} onClick={() => { setPinChild(null); setPinValue('') }}>Avbryt</button>
              <button style={s.btn('primary')} onClick={savePin} disabled={pinValue.length !== 4 || pinSaving}>
                {pinSaving ? 'Sparar...' : 'Spara PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddChild && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowAddChild(false)}>
          <div style={s.modalCard}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:'1.5rem', marginBottom:'1.5rem' }}>Lägg till barn</h2>
            <label style={s.label}>Namn</label>
            <input style={s.input} value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="Barnets namn" autoFocus />
            <label style={s.label}>Färg</label>
            <div style={s.colorPicker}>
              {AVATAR_COLORS.map(c => <div key={c} style={s.colorDot(c, newChildColor === c)} onClick={() => setNewChildColor(c)} />)}
            </div>
            <div style={s.modalActions}>
              <button style={s.btn()} onClick={() => setShowAddChild(false)}>Avbryt</button>
              <button style={s.btn('primary')} onClick={addChild}>Lägg till</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
