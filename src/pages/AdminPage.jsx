import React, { useState, useEffect } from 'react'
import { vendorSpecsService } from '../services/db'
import TextureManager from '../components/admin/TextureManager'

const DEFAULT_SPECS = {
    boardThickness: '18mm',
    backPanel: '9mm',
    hardware: '鋅合金暗鉸鏈',
    maxCabinetWidth: '90cm',
    minCabinetWidth: '30cm',
    maxCabinetHeight: '240cm',
    surfaceFinish: '雙面美耐板',
    edgeBanding: '0.4mm ABS 封邊',
    notes: ''
}

export default function AdminPage({ toast }) {
    const [activeTab, setActiveTab] = useState('api')
    const [apiKey, setApiKey] = useState('')
    const [apiKeyVisible, setApiKeyVisible] = useState(false)
    const [specs, setSpecs] = useState(DEFAULT_SPECS)
    const [specsSaving, setSpecsSaving] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('gemini_api_key')
        if (saved) setApiKey(saved)
        vendorSpecsService.getAll().then(s => {
            if (Object.keys(s).length > 0) {
                setSpecs(prev => ({ ...prev, ...s }))
            }
        })
    }, [])

    const saveApiKey = () => {
        localStorage.setItem('gemini_api_key', apiKey.trim())
        toast('API Key 已儲存 ✓', 'success')
    }

    const saveSpecs = async () => {
        setSpecsSaving(true)
        try {
            await vendorSpecsService.setAll(specs)
            toast('廠商規格已儲存 ✓', 'success')
        } catch {
            toast('儲存失敗', 'error')
        } finally {
            setSpecsSaving(false)
        }
    }

    const tabs = [
        { id: 'api', icon: '🔑', label: 'AI API 設定' },
        { id: 'specs', icon: '📋', label: '廠商規格' },
        { id: 'textures', icon: '🖼', label: '材質管理' }
    ]

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-title">後台管理</div>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        className={`admin-sidebar-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </aside>

            <div className="admin-main">
                {activeTab === 'api' && (
                    <>
                        <h2 className="admin-section-title">🔑 AI API 設定</h2>
                        <div className="card" style={{ maxWidth: 560 }}>
                            <div className="form-group">
                                <label className="form-label">Gemini API Key</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        className="form-input"
                                        type={apiKeyVisible ? 'text' : 'password'}
                                        placeholder="AIza..."
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                    />
                                    <button className="btn btn-secondary" onClick={() => setApiKeyVisible(v => !v)}>
                                        {apiKeyVisible ? '🙈' : '👁'}
                                    </button>
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    前往 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>aistudio.google.com</a> 取得 API Key
                                </p>
                            </div>
                            <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                                📌 使用模型：<strong style={{ color: 'var(--accent)' }}>gemini-2.5-flash-image</strong>（支援圖片生成）
                            </div>
                            <button className="btn btn-primary" onClick={saveApiKey} disabled={!apiKey.trim()}>
                                💾 儲存 API Key
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'specs' && (
                    <>
                        <h2 className="admin-section-title">📋 廠商規格設定</h2>
                        <div className="card" style={{ maxWidth: 600 }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">板材厚度（主板）</label>
                                    <input className="form-input" value={specs.boardThickness} onChange={e => setSpecs(s => ({ ...s, boardThickness: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">背板厚度</label>
                                    <input className="form-input" value={specs.backPanel} onChange={e => setSpecs(s => ({ ...s, backPanel: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">最大寬度</label>
                                    <input className="form-input" value={specs.maxCabinetWidth} onChange={e => setSpecs(s => ({ ...s, maxCabinetWidth: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">最小寬度</label>
                                    <input className="form-input" value={specs.minCabinetWidth} onChange={e => setSpecs(s => ({ ...s, minCabinetWidth: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">最大高度</label>
                                    <input className="form-input" value={specs.maxCabinetHeight} onChange={e => setSpecs(s => ({ ...s, maxCabinetHeight: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">五金配件</label>
                                    <input className="form-input" value={specs.hardware} onChange={e => setSpecs(s => ({ ...s, hardware: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">表面處理</label>
                                    <input className="form-input" value={specs.surfaceFinish} onChange={e => setSpecs(s => ({ ...s, surfaceFinish: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">封邊規格</label>
                                    <input className="form-input" value={specs.edgeBanding} onChange={e => setSpecs(s => ({ ...s, edgeBanding: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">備注（會加入 AI Prompt）</label>
                                <textarea className="form-textarea" value={specs.notes} onChange={e => setSpecs(s => ({ ...s, notes: e.target.value }))} placeholder="額外規格說明..." />
                            </div>
                            <button className="btn btn-primary" onClick={saveSpecs} disabled={specsSaving}>
                                {specsSaving ? '儲存中...' : '💾 儲存規格'}
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'textures' && (
                    <>
                        <h2 className="admin-section-title">🖼 材質管理</h2>
                        <TextureManager toast={toast} />
                    </>
                )}
            </div>
        </div>
    )
}
