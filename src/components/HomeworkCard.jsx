import { format, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { sv } from 'date-fns/locale'

function getDaysUntil(dateStr) {
  if (!dateStr) return null
  return differenceInDays(new Date(dateStr), new Date(new Date().toDateString()))
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isToday(d)) return 'idag'
  if (isTomorrow(d)) return 'imorgon'
  return format(d, 'EEE d MMM', { locale: sv })
}

function getStatus(material) {
  const dueIn = getDaysUntil(material.due_date)
  const examIn = getDaysUntil(material.exam_date)

  if (dueIn !== null && dueIn <= 1) return 'urgent'
  if (material.is_exam && examIn !== null && examIn <= 5) return 'exam'
  return 'ok'
}

const COLORS = {
  urgent: { border: 'var(--urgent)', badge: { bg: 'var(--urgent-light)', color: 'var(--urgent-text)' } },
  exam:   { border: 'var(--exam)',   badge: { bg: 'var(--exam-light)',   color: 'var(--exam-text)'   } },
  ok:     { border: 'var(--ok)',     badge: { bg: 'var(--ok-light)',     color: 'var(--ok-text)'     } },
}

const LABELS = { urgent: 'Snart inlämning', exam: 'Prov nära', ok: 'God tid' }

export default function HomeworkCard({ material, onEdit, onDelete, onGenerate, hasExercises }) {
  const status = getStatus(material)
  const c = COLORS[status]
  const dueIn = getDaysUntil(material.due_date)
  const examIn = getDaysUntil(material.exam_date)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderLeft: `3px solid ${c.border}`,
      borderRadius: `0 var(--radius-lg) var(--radius-lg) 0`,
      padding: '1rem 1.25rem',
      marginBottom: '10px',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom: material.is_exam ? '10px' : '0' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
            <p style={{ fontWeight:500, fontSize:'15px', color:'var(--text-primary)', margin:0 }}>{material.subject}</p>
            <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'20px', background: c.badge.bg, color: c.badge.color, whiteSpace:'nowrap' }}>
              {LABELS[status]}
            </span>
          </div>
          {material.description && (
            <p style={{ fontSize:'13px', color:'var(--text-secondary)', margin:0 }}>{material.description}</p>
          )}
        </div>
        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
          {onGenerate && (
            <button onClick={() => onGenerate(material)} style={{ fontSize:'12px', padding:'4px 10px', border:'0.5px solid var(--accent)', color:'var(--accent)', background: hasExercises ? 'var(--accent)' : 'transparent', color: hasExercises ? '#fff' : 'var(--accent)', borderRadius:'var(--radius-sm)', cursor:'pointer' }}>
              {hasExercises ? 'Visa övningar' : 'Generera övningar'}
            </button>
          )}
          {onEdit && <button onClick={() => onEdit(material)} style={{ fontSize:'12px', padding:'4px 8px', border:'0.5px solid var(--border-strong)', color:'var(--text-secondary)', background:'transparent', borderRadius:'var(--radius-sm)', cursor:'pointer' }}>Redigera</button>}
          {onDelete && <button onClick={() => onDelete(material.id)} style={{ fontSize:'12px', padding:'4px 8px', border:'none', color:'var(--urgent)', background:'transparent', cursor:'pointer' }}>Ta bort</button>}
        </div>
      </div>

      {material.is_exam && material.exam_date && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--exam-light)', borderRadius:'var(--radius-md)', padding:'7px 10px', marginBottom:'10px' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="2" stroke="#BA7517" strokeWidth="1.2"/>
            <path d="M4 6h6M4 8.5h4" stroke="#BA7517" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M4 4h1.5" stroke="#BA7517" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize:'12px', color:'var(--exam-text)', fontWeight:500 }}>
            Prov {examIn === 0 ? 'idag' : examIn === 1 ? 'imorgon' : `om ${examIn} dagar`}
            {material.exam_subject ? ` · ${material.exam_subject}` : ''}
            {' · '}{formatDate(material.exam_date)}
          </span>
        </div>
      )}

      <div style={{ display:'flex', gap:'1.5rem', fontSize:'12px', color:'var(--text-secondary)', borderTop: (material.is_exam || material.due_date) ? '0.5px solid var(--border)' : 'none', paddingTop: (material.is_exam || material.due_date) ? '10px' : '0', marginTop: (material.is_exam || material.due_date) ? '10px' : '0' }}>
        {material.due_date && (
          <span>Inlämning <strong style={{ color:'var(--text-primary)' }}>{formatDate(material.due_date)}</strong></span>
        )}
        {material.is_exam && material.exam_date && (
          <span>Prov <strong style={{ color:'var(--exam)', }}>{formatDate(material.exam_date)}</strong></span>
        )}
        {!material.is_exam && (
          <span style={{ color:'var(--text-hint)' }}>Inget prov</span>
        )}
      </div>
    </div>
  )
}
