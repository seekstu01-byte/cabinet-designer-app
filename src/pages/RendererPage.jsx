import React, { useState, useEffect } from 'react'
import { generateCabinetRender, buildPrompt } from '../services/geminiApi'
import { vendorSpecsService } from '../services/db'

const FLOOR_OPTIONS = [
    { value: 'polished', label: '🪨 拋光磁磚', desc: '光澤感，現代風' },
    { value: 'wood-light', label: '🪵 淺色木地板', desc: '溫暖，北歐風' },
    { value: 'wood-dark', label: '🌑 深色木地板', desc: '沉穩，現代風' }
]

const LIGHT_TEMPS = [
    { value: '3000K', label: '3000K 暖光', color: '#fbbf24' },
    { value: '4000K', label: '4000K 自然光', color: '#e5e7eb' },
    { value: '6000K', label: '6000K 冷白光', color: '#bfdbfe' }
]

export default function RendererPage({ toast }) {
    const [environment, setEnvironment] = useState({ floor: 'wood-light', lightTemp: '4000K' })
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [hasSketch, setHasSketch] = useState(false)
    const [materials, setMaterials] = useState({})

    useEffect(() => {
        const sketch = sessionStorage.getItem('cabinet_sketch')
        const mats = sessionStorage.getItem('cabinet_materials')
        setHasSketch(!!sketch)
        if (mats) {
            try { setMaterials(JSON.parse(mats)) } catch { /* ok */ }
        }
    }, [])

    const handleRender = async () => {
        const apiKey = localStorage.getItem('gemini_api_key')
        if (!apiKey) {
            toast('請先在後台設定 Gemini API Key', 'error')
            return
        }

        const sketchBase64 = sessionStorage.getItem('cabinet_sketch')
        if (!sketchBase64) {
            toast('請先在編輯器產生線稿並點擊「匯出線稿」', 'error')
            return
        }

        setLoading(true)
        setResult(null)

        try {
            const vendorSpecs = await vendorSpecsService.getAll()
            const prompt = buildPrompt({ materials, vendorSpecs, environment })
            const res = await generateCabinetRender({
                apiKey,
                imageBase64: sketchBase64,
                prompt
            })
            setResult(res)
            toast('🎨 渲染完成！', 'success')
        } catch (err) {
            toast(`渲染失敗：${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const downloadResult = () => {
        if (!result) return
        const link = document.createElement('a')
        link.download = `cabinet-render-${Date.now()}.jpg`
        link.href = `data:${result.mimeType};base64,${result.imageData}`
        link.click()
    }

    return (
        <div className="renderer-layout">
            {/* Controls */}
            <div className="renderer-controls">
                <div className="section-title">線稿狀態</div>
                <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius)',
                    background: hasSketch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${hasSketch ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: 13, marginBottom: 16,
                    color: hasSketch ? 'var(--success)' : 'var(--danger)'
                }}>
                    {hasSketch ? '✅ 線稿已載入，可以渲染' : '⚠️ 尚未有線稿，請先到編輯器匯出'}
                </div>

                {Object.keys(materials).some(k => materials[k]) && (
                    <>
                        <div className="section-title">已選材質</div>
                        <div style={{ marginBottom: 16 }}>
                            {Object.entries(materials).filter(([, v]) => v).map(([k, v]) => (
                                <div key={k} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {{ exterior: '外部', interior: '內部', door: '門片', drawer: '抽屜' }[k]}：
                                    </span>
                                    {v}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="section-title">地板材質</div>
                <div className="radio-group" style={{ marginBottom: 16 }}>
                    {FLOOR_OPTIONS.map(o => (
                        <div
                            key={o.value}
                            className={`radio-option ${environment.floor === o.value ? 'selected' : ''}`}
                            onClick={() => setEnvironment(e => ({ ...e, floor: o.value }))}
                        >
                            <input type="radio" readOnly checked={environment.floor === o.value} />
                            <label>
                                <div>{o.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.desc}</div>
                            </label>
                        </div>
                    ))}
                </div>

                <div className="section-title">投射燈色溫</div>
                <div className="color-temp-group" style={{ marginBottom: 20 }}>
                    {LIGHT_TEMPS.map(l => (
                        <button
                            key={l.value}
                            className={`color-temp-btn ${environment.lightTemp === l.value ? 'selected' : ''}`}
                            onClick={() => setEnvironment(e => ({ ...e, lightTemp: l.value }))}
                            style={environment.lightTemp === l.value ? { borderColor: l.color, color: l.color, background: `${l.color}18` } : {}}
                        >
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, margin: '0 auto 4px' }} />
                            {l.value}
                        </button>
                    ))}
                </div>

                <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%' }}
                    onClick={handleRender}
                    disabled={loading || !hasSketch}
                >
                    {loading ? '🤖 AI 渲染中...' : '🎨 開始 AI 渲染'}
                </button>

                {result && (
                    <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={downloadResult}>
                        ⬇️ 下載效果圖
                    </button>
                )}
            </div>

            {/* Result area */}
            <div className="renderer-output">
                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div className="spinner" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Gemini 渲染中，請稍候...</p>
                    </div>
                )}

                {!loading && !result && (
                    <div className="render-placeholder">
                        <div className="render-placeholder-icon">🎨</div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>尚未渲染</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300 }}>
                            請先在編輯器設計櫃體、匯出線稿，再點擊「開始 AI 渲染」
                        </p>
                    </div>
                )}

                {result && !loading && (
                    <div className="render-result">
                        <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                            <span className="badge badge-green">✓ 渲染完成</span>
                            <span className="badge badge-purple">Gemini 2.0</span>
                        </div>
                        <img
                            src={`data:${result.mimeType};base64,${result.imageData}`}
                            alt="AI 渲染效果圖"
                        />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            由 Gemini 2.0 Flash Experimental 生成
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
