import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useChildAuth } from '../context/ChildAuthContext'

// Requires DB migration: ALTER TABLE profiles ADD COLUMN pin TEXT;
// Requires Supabase RLS anon policy: allow SELECT on profiles WHERE role = 'child'

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' },
  title: { fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' },
  sub: { color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '2.5rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', width: '100%', maxWidth: '560px', marginBottom: '2rem' },
  card: (color) => ({ background: 'var(--surface)', border: `1.5px solid ${color}`, borderRadius: 'var(--radius-lg)', padding: '1.5rem 1rem', cursor: 'pointer', textAlign: 'center', transition: 'transform .1s, box-shadow .1s', ':hover': { transform: 'scale(1.03)' } }),
  avatar: (color) => ({ width: '56px', height: '56px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '20px', margin: '0 auto 10px' }),
  childName: { fontWeight: 500, fontSize: '15px', color: 'var(--text-primary)' },
  pinSection: { width: '100%', maxWidth: '320px', textAlign: 'center' },
  pinHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' },
  backBtn: { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 },
  pinAvatar: (color) => ({ width: '48px', height: '48px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '18px', flexShrink: 0 }),
  pinName: { fontWeight: 500, fontSize: '17px', color: 'var(--text-primary)' },
  dots: { display: 'flex', gap: '14px', justifyContent: 'center', marginBottom: '2rem' },
  dot: (filled) => ({ width: '16px', height: '16px', borderRadius: '50%', background: filled ? 'var(--accent)' : 'var(--border-strong)', transition: 'background .15s' }),
  pad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1rem' },
  key: { padding: '18px 0', fontSize: '22px', fontWeight: 400, background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)', transition: 'background .1s' },
  keyDelete: { padding: '18px 0', fontSize: '18px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)', gridColumn: 'span 1' },
  error: { color: 'var(--urgent, #D85A30)', fontSize: '14px', marginTop: '0.5rem', minHeight: '20px' },
  empty: { color: 'var(--text-secondary)', fontSize: '14px', padding: '2rem' },
}

const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

function PinPad({ child, onSuccess, onBack }) {
  const [digits, setDigits] = useState([])
  const [error, setError] = useState('')
  const { loginAsChild } = useChildAuth()
  const navigate = useNavigate()

  function pressKey(d) {
    if (digits.length >= 4) return
    const next = [...digits, d]
    setDigits(next)
    setError('')

    if (next.length === 4) {
      const entered = next.join('')
      console.log('PIN debug — angiven:', entered, '| sparad:', child.pin, '| typ:', typeof child.pin)
      if (entered === String(child.pin ?? '').trim()) {
        loginAsChild(child)
        navigate(`/kids/${child.id}`)
      } else {
        setTimeout(() => {
          setDigits([])
          setError('Fel PIN, försök igen')
        }, 300)
      }
    }
  }

  function deleteLast() {
    setDigits(d => d.slice(0, -1))
    setError('')
  }

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div style={s.pinSection}>
      <div style={s.pinHeader}>
        <button style={s.backBtn} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Byt
        </button>
        <div style={s.pinAvatar(child.avatar_color)}>{initials(child.name)}</div>
        <span style={s.pinName}>{child.name}</span>
      </div>

      <div style={s.dots}>
        {[0, 1, 2, 3].map(i => <div key={i} style={s.dot(i < digits.length)} />)}
      </div>

      <div style={s.pad}>
        {keys.map(k => (
          <button key={k} style={s.key} onClick={() => pressKey(String(k))}>{k}</button>
        ))}
        <div />
        <button style={s.key} onClick={() => pressKey('0')}>0</button>
        <button style={s.keyDelete} onClick={deleteLast}>⌫</button>
      </div>

      <div style={s.error}>{error}</div>
    </div>
  )
}

export default function ChildSelect() {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role, avatar_color, pin')
      .eq('role', 'child')
      .order('created_at')
      .then(({ data }) => {
        setChildren(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={{ ...s.page }}>
      <p style={{ color: 'var(--text-secondary)' }}>Laddar...</p>
    </div>
  )

  return (
    <div style={s.page}>
      {!selected ? (
        <>
          <h1 style={s.title}>Hej! Vem är du?</h1>
          <p style={s.sub}>Välj ditt namn för att börja</p>

          {children.length === 0 ? (
            <p style={s.empty}>Inga barn tillagda än. Be en förälder lägga till dig!</p>
          ) : (
            <div style={s.grid}>
              {children.map(child => (
                <div
                  key={child.id}
                  style={s.card(child.avatar_color ?? '#534AB7')}
                  onClick={() => setSelected(child)}
                >
                  <div style={s.avatar(child.avatar_color ?? '#534AB7')}>{initials(child.name)}</div>
                  <p style={s.childName}>{child.name}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <PinPad
          child={selected}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  )
}
