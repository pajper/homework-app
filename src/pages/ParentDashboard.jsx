import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HomeworkCard from '../components/HomeworkCard'

const AVATAR_COLORS = ['#534AB7','#1D9E75','#D85A30','#D4537E','#378ADD','#BA7517']

const s = {
  page: { minHeight:'100vh', background:'var(--bg)', padding:'1.5rem 1rem' },
  header: { maxWidth:'800px', margin:'0 auto 2rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' },
  title: { fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:300, color:'var(--text-primary)' },
  sub: { fontSize:'14px', color:'var(--text-secondary)', marginTop:'2px' },
  main: { maxWidth:'800px', margin:'0 auto' },
  sectionTitle: { fontSize:'13px', fontWeight:500, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 12px' },
  childGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px', marginBottom:'2.5rem' },
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
  const [family, setFamily] = useState(null)
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [materials, setMaterials] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildColor, setNewChildColor] = useState(AVATAR_COLORS[0])

  const [pinChild, setPinChild] = useState(null)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  const [showInvite, setShowInvite] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { init() }, [profile])
  useEffect(() => { if (selectedChild) { fetchMaterials(selectedChild.id); fetchSessions(selectedChild.id) } }, [selectedChild])

  async function init() {
    if (!profile) return
    try {
      const fam = await ensureFamily()
      if (fam) {
        setFamily(fam)
        await fetchChildren(fam.id)
      }
    } catch (e) {
      console.error('init error:', e)
    }
    setLoading(false)
  }

  async function ensureFamily() {
    // Check if parent already has a family
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', profile.id)
      .single()

    let fam = null

    if (parentProfile?.family_id) {
      const { data } = await supabase
        .from('families')
        .select('*')
        .eq('id', parentProfile.family_id)
        .single()
      fam = data
    } else {
      // Create a new family
      const { data: newFamily, error } = await supabase
        .from('families')
        .insert({})
        .select()
        .single()

      if (error || !newFamily) { console.error('Kunde inte skapa familj:', error); return null }

      await supabase
        .from('profiles')
        .update({ family_id: newFamily.id })
        .eq('id', profile.id)

      fam = newFamily
    }

    // Backfill: sätt family_id på befintliga barn som saknar det
    if (fam) {
      await supabase
        .from('profiles')
        .update({ family_id: fam.id })
        .eq('parent_id', profile.id)
        .is('family_id', null)
    }

    return fam
  }

  async function fetchChildren(familyId) {
    const fid = familyId ?? family?.id
    if (!fid) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'child')
      .eq('family_id', fid)
      .order('created_at')
    setChildren(data ?? [])
    if (data?.length > 0 && !selectedChild) setSelectedChild(data[0])
  }

  async function fetchSessions(childId) {
    const { data } = await supabase
      .from('exercise_sessions')
      .select('*, materials(subject)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10)
    setSessions(data ?? [])
  }

  async function fetchMaterials(childId) {
    const { data } = await supabase
      .from('materials')
      .select('*, exercises(count)')
      .eq('child_id', childId)
      .order('due_date', { ascending: true, nullsFirst: false })
    setMaterials(data ?? [])
  }

  async function addChild() {
    if (!newChildName.trim() || !family) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        name: newChildName.trim(),
        role: 'child',
        parent_id: user.id,
        family_id: family.id,
        avatar_color: newChildColor,
      })
    if (error) { console.error(error); return }
    setShowAddChild(false)
    setNewChildName('')
    fetchChildren()
  }

  async function joinFamily() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError('')

    const { data: fam } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', code)
      .single()

    if (!fam) {
      setJoinError('Ingen familj hittades med den koden.')
      setJoinLoading(false)
      return
    }

    await supabase.from('profiles').update({ family_id: fam.id }).eq('id', profile.id)
    setFamily(fam)
    setShowJoin(false)
    setJoinCode('')
    await fetchChildren(fam.id)
    setJoinLoading(false)
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
    if (error) { console.error(error); alert('Kunde inte spara PIN: ' + error.message); setPinSaving(false); return }
    setPinSaving(false)
    setPinChild(null)
    setPinValue('')
    fetchChildren()
  }

  function copyInviteCode() {
    if (!family?.invite_code) return
    navigator.clipboard.writeText(family.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Läxhjälpen</h1>
          <p style={s.sub}>Hej {profile?.name} — välkommen tillbaka</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={() => setShowInvite(true)} style={{ ...s.btn(), fontSize:'13px', padding:'6px 12px' }}>
            👨‍👩‍👧 Bjud in
          </button>
          <button onClick={signOut} style={s.signout}>Logga ut</button>
        </div>
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
                    hasExercises={(m.exercises?.[0]?.count ?? 0) > 0}
                  />
                ))
            }

            {sessions.length > 0 && (
              <>
                <p style={{ ...s.sectionTitle, marginTop: '2rem' }}>Senaste övningarna</p>
                {sessions.map(sess => {
                  const pct = Math.round((sess.score / sess.total) * 100)
                  const color = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#BA7517' : '#D85A30'
                  return (
                    <div key={sess.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'10px 14px', marginBottom:'8px' }}>
                      <div>
                        <p style={{ fontWeight:500, fontSize:'14px', margin:0, color:'var(--text-primary)' }}>{sess.materials?.subject ?? '—'}</p>
                        <p style={{ fontSize:'12px', color:'var(--text-secondary)', margin:'2px 0 0' }}>
                          {new Date(sess.created_at).toLocaleDateString('sv-SE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ fontWeight:700, fontSize:'16px', color }}>{sess.score}/{sess.total}</span>
                        <p style={{ fontSize:'11px', color, margin:'1px 0 0' }}>{pct}%</p>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {!selectedChild && !loading && (
          <div style={s.empty}>Lägg till ett barn för att komma igång</div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div style={s.modalCard}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:'1.5rem', marginBottom:'0.5rem' }}>Bjud in till familjen</h2>
            <p style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'1.5rem' }}>Dela denna kod med en annan förälder. De klickar på "Gå med i familj" och skriver in koden.</p>

            <div style={{ background:'var(--accent-light)', borderRadius:'var(--radius-lg)', padding:'1.25rem', textAlign:'center', marginBottom:'1rem' }}>
              <p style={{ fontSize:'13px', color:'var(--accent-text)', marginBottom:'6px', fontWeight:500 }}>Er inbjudningskod</p>
              <p style={{ fontFamily:'var(--font-display)', fontSize:'2.5rem', fontWeight:400, letterSpacing:'0.15em', color:'var(--accent)', margin:0 }}>
                {family?.invite_code}
              </p>
            </div>

            <button onClick={copyInviteCode} style={{ ...s.btn('primary'), width:'100%', marginBottom:'8px' }}>
              {copied ? '✓ Kopierad!' : 'Kopiera kod'}
            </button>

            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:'1rem', marginTop:'0.5rem' }}>
              <p style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'8px' }}>Eller gå med i en annan familj:</p>
              <button onClick={() => { setShowInvite(false); setShowJoin(true) }} style={{ ...s.btn(), width:'100%' }}>
                Gå med i familj med kod
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join family modal */}
      {showJoin && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && (setShowJoin(false), setJoinCode(''), setJoinError(''))}>
          <div style={s.modalCard}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:300, fontSize:'1.5rem', marginBottom:'0.5rem' }}>Gå med i familj</h2>
            <p style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'1.5rem' }}>Skriv in koden du fått från en annan förälder.</p>
            <label style={s.label}>Inbjudningskod</label>
            <input
              style={{ ...s.input, letterSpacing:'0.2em', fontSize:'20px', textAlign:'center', textTransform:'uppercase' }}
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase().slice(0,6)); setJoinError('') }}
              placeholder="ABC123"
              autoFocus
            />
            {joinError && <p style={{ fontSize:'13px', color:'var(--urgent)', marginTop:'-8px', marginBottom:'12px' }}>{joinError}</p>}
            <div style={s.modalActions}>
              <button style={s.btn()} onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError('') }}>Avbryt</button>
              <button style={s.btn('primary')} onClick={joinFamily} disabled={joinCode.length < 4 || joinLoading}>
                {joinLoading ? 'Söker...' : 'Gå med'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN modal */}
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

      {/* Add child modal */}
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
