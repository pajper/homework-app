import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ChildAuthProvider } from './context/ChildAuthContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChildAuthProvider>
          <App />
        </ChildAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
