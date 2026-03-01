import React, { useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import EditorPage from './pages/EditorPage'
import RendererPage from './pages/RendererPage'

export default function App() {
  const [toasts, setToasts] = useState([])

  const addToast = (msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  return (
    <HashRouter>
      <div className="app-layout">
        <header className="app-header">
          <NavLink to="/editor" className="logo">
            <div className="logo-icon">🗄</div>
            <span>系統櫃繪製系統</span>
          </NavLink>
          <nav className="app-nav">
            <NavLink to="/admin" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              ⚙️ 後台設定
            </NavLink>
            <NavLink to="/editor" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              ✏️ 編輯器
            </NavLink>
            <NavLink to="/renderer" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
              🎨 AI 渲染
            </NavLink>
          </nav>
        </header>

        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/editor" replace />} />
            <Route path="/admin" element={<AdminPage toast={addToast} />} />
            <Route path="/editor" element={<EditorPage toast={addToast} />} />
            <Route path="/renderer" element={<RendererPage toast={addToast} />} />
          </Routes>
        </main>
      </div>

      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </HashRouter>
  )
}
