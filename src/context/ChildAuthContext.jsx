import { createContext, useContext, useState } from 'react'

const ChildAuthContext = createContext(null)

export function ChildAuthProvider({ children }) {
  const [childUser, setChildUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('child_session')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  function loginAsChild(child) {
    sessionStorage.setItem('child_session', JSON.stringify(child))
    setChildUser(child)
  }

  function logoutChild() {
    sessionStorage.removeItem('child_session')
    setChildUser(null)
  }

  return (
    <ChildAuthContext.Provider value={{ childUser, loginAsChild, logoutChild }}>
      {children}
    </ChildAuthContext.Provider>
  )
}

export const useChildAuth = () => useContext(ChildAuthContext)
