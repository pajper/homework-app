const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

let tokenClient = null

function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

export async function getGoogleToken() {
  await loadGIS()
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return }
        resolve(resp.access_token)
      },
    })
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

async function gFetch(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Google API error: ${res.status}`)
  return res.json()
}

export async function fetchCourses(token) {
  const data = await gFetch(token, 'https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE')
  return data.courses ?? []
}

export async function fetchCourseWork(token, courseId) {
  const data = await gFetch(token, `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?orderBy=dueDate%20desc&pageSize=20`)
  return data.courseWork ?? []
}

export async function fetchSubmissions(token, courseId, courseWorkId) {
  const data = await gFetch(token, `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?states=TURNED_IN,RETURNED,RECLAIMED_BY_STUDENT`)
  return data.studentSubmissions ?? []
}

export async function fetchDriveFile(token, fileId) {
  // Get file metadata
  const meta = await gFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`)
  return meta
}

export async function downloadDriveFileAsBase64(token, fileId, mimeType) {
  let url
  if (mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Drive download error: ${res.status}`)

  if (mimeType === 'application/vnd.google-apps.document') {
    return { text: await res.text(), type: 'text' }
  }
  if (mimeType === 'application/pdf') {
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return { base64: btoa(binary), type: 'pdf' }
  }
  return { text: await res.text(), type: 'text' }
}

// Parse due date from Classroom courseWork
export function parseDueDate(cw) {
  if (!cw.dueDate) return null
  const { year, month, day } = cw.dueDate
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
