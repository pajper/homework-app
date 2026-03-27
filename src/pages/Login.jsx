import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const s = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--bg)' },
  card: { background:'var(--surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-xl)', padding:'2.5rem', width:'100%', maxWidth:'400px' },
  title: { fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:300, marginBottom:'0.25rem', color:'var(--text-primary)' },
  sub: { color:'var(--text-secondary)', fontSize:'14px', marginBottom:'2rem' },
  tabs: { display:'flex', gap:'0', marginBottom:'2rem', border:'0.5px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  tab: (active) => ({ flex:1, padding:'8px', border:'none', background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontSize:'14px', fontWeight:'500', cursor:'pointer', transition:'all .15s' }),
  label: { display:'block', fontSize:'13px', color:'var(--text-secondary)', marginBottom:'6px', fontWeight:'500' },
  input: { width:'100%', padding:'10px 12px', border:'0.5px solid var(--border-strong)', borderRadius:'var(--radius-md)', fontSize:'15px', background:'var(--surface)', color:'var(--text-primary)', outline:'none', marginBottom:'1rem' },
  btn: { width:'100%', padding:'12px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius-md)', fontSize:'15px', fontWeight:'500', cursor:'pointer', marginTop:'0.5rem' },
  error: { background:'var(--urgent-light)', color:'var(--urgent-text)', borderRadius:'var(--radius-md)', padding:'10px 12px', fontSize:'13px', marginBottom:'1rem' },
}

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = tab === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Läxhjälpen</h1>
        <p style={s.sub}>Logga in som förälder</p>

        <div style={s.tabs}>
          <button style={s.tab(tab==='login')} onClick={() => setTab('login')}>Logga in</button>
          <button style={s.tab(tab==='register')} onClick={() => setTab('register')}>Skapa konto</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <>
              <label style={s.label}>Ditt namn</label>
              <input style={s.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Mamma / Pappa" required />
            </>
          )}
          <label style={s.label}>E-post</label>
          <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="du@exempel.se" required />
          <label style={s.label}>Lösenord</label>
          <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Vänta...' : tab === 'login' ? 'Logga in' : 'Skapa konto'}
          </button>
        </form>
      </div>
    </div>
  )
}
