import React, { useState, useEffect } from 'react'
import { generateCabinetRender, buildPrompt } from '../services/geminiApi'
import { vendorSpecsService, renderHistoryService } from '../services/db'

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
    const [environment, setEnvironment] = useState({ floor: 'wood-light', lightTemp: '4000K', doorState: 'closed', aspectRatio: '16:9' })
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [hasSketch, setHasSketch] = useState(false)
    const [materials, setMaterials] = useState({})
    const [cabinetConfig, setCabinetConfig] = useState(null)
    const [sketchThumb, setSketchThumb] = useState(null)
    const [promptText, setPromptText] = useState('')
    const [showPrompt, setShowPrompt] = useState(false)
    const [history, setHistory] = useState([])

    useEffect(() => {
        const sketch = sessionStorage.getItem('cabinet_sketch')
        const mats = sessionStorage.getItem('cabinet_materials')
        const config = sessionStorage.getItem('cabinet_config')
        setHasSketch(!!sketch)
        if (sketch) setSketchThumb(`data:image/jpeg;base64,${sketch}`)
        if (mats) {
            try { setMaterials(JSON.parse(mats)) } catch { /* ok */ }
        }
        if (config) {
            try { setCabinetConfig(JSON.parse(config)) } catch { /* ok */ }
        }
        renderHistoryService.getAll().then(setHistory)
    }, [])

    // Rebuild prompt when settings change
    useEffect(() => {
        async function rebuildPrompt() {
            const vendorSpecs = await vendorSpecsService.getAll()
            const prompt = buildPrompt({ cabinets: cabinetConfig?.cabinets, materials, vendorSpecs, environment })
            setPromptText(prompt)
        }
        rebuildPrompt()
    }, [materials, environment, cabinetConfig])

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
            const res = await generateCabinetRender({
                apiKey,
                imageBase64: sketchBase64,
                prompt: promptText
            })
            setResult(res)
            // Add to history in DB
            const newHistoryItem = {
                imageData: res.imageData,
                mimeType: res.mimeType
            }
            await renderHistoryService.add(newHistoryItem)
            const updatedHistory = await renderHistoryService.getAll()
            setHistory(updatedHistory)
            toast('🎨 渲染完成！', 'success')
        } catch (err) {
            toast(`渲染失敗：${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const downloadResult = (res) => {
        if (!res) return
        const link = document.createElement('a')
        link.download = `cabinet-render-${Date.now()}.jpg`
        link.href = `data:${res.mimeType};base64,${res.imageData}`
        link.click()
    }

    const copyPrompt = () => {
        navigator.clipboard.writeText(promptText).then(() => {
            toast('📋 Prompt 已複製到剪貼簿', 'success')
        }).catch(() => {
            toast('複製失敗', 'error')
        })
    }

    return (
        <div className="renderer-layout">
            {/* Controls */}
            <div className="renderer-controls">
                {/* Sketch preview */}
                <div className="section-title" style={{ marginTop: 0 }}>線稿預覽</div>
                {sketchThumb ? (
                    <div style={{
                        borderRadius: 'var(--radius)', overflow: 'hidden',
                        border: '1px solid var(--border)', marginBottom: 16
                    }}>
                        <img
                            src={sketchThumb}
                            alt="線稿預覽"
                            style={{ width: '100%', display: 'block', background: 'var(--bg-base)' }}
                        />
                        <div style={{
                            padding: '6px 10px', fontSize: 11, color: 'var(--success)',
                            background: 'rgba(16,185,129,0.06)'
                        }}>
                            ✅ 線稿已載入
                            {cabinetConfig && (
                                <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>
                                    {cabinetConfig.cabinets?.length || 1} 個櫃體
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{
                        padding: '10px 14px', borderRadius: 'var(--radius)',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        fontSize: 13, marginBottom: 16,
                        color: 'var(--danger)'
                    }}>
                        ⚠️ 尚未有線稿，請先到編輯器匯出
                    </div>
                )}

                {/* Material summary */}
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

                <div className="section-title">渲染比例</div>
                <div className="radio-group" style={{ marginBottom: 16 }}>
                    <label className={`radio-option ${environment.aspectRatio === '16:9' ? 'active' : ''}`} style={environment.aspectRatio === '16:9' ? { background: 'rgba(37,99,235,0.08)', borderColor: 'var(--accent)' } : {}}>
                        <input
                            type="radio"
                            name="aspectRatio"
                            value="16:9"
                            checked={environment.aspectRatio === '16:9'}
                            onChange={e => setEnvironment(prev => ({ ...prev, aspectRatio: e.target.value }))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>🖥️ 16:9 橫式</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>展示整體寬闊空間感</span>
                        </div>
                    </label>
                    <label className={`radio-option ${environment.aspectRatio === '5:4' ? 'active' : ''}`} style={environment.aspectRatio === '5:4' ? { background: 'rgba(37,99,235,0.08)', borderColor: 'var(--accent)' } : {}}>
                        <input
                            type="radio"
                            name="aspectRatio"
                            value="5:4"
                            checked={environment.aspectRatio === '5:4'}
                            onChange={e => setEnvironment(prev => ({ ...prev, aspectRatio: e.target.value }))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>🖼️ 5:4 傳統</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>偏向正方形的傳統視角</span>
                        </div>
                    </label>
                </div>

                <div className="section-title">櫃門狀態</div>
                <div className="radio-group" style={{ marginBottom: 16 }}>
                    <label className={`radio-option ${environment.doorState === 'closed' ? 'active' : ''}`} style={environment.doorState === 'closed' ? { background: 'rgba(37,99,235,0.08)', borderColor: 'var(--accent)' } : {}}>
                        <input
                            type="radio"
                            name="doorState"
                            value="closed"
                            checked={environment.doorState === 'closed'}
                            onChange={e => setEnvironment(prev => ({ ...prev, doorState: e.target.value }))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>🚪 關門 (外觀)</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>維持原本門片顯示狀態</span>
                        </div>
                    </label>
                    <label className={`radio-option ${environment.doorState === 'open' ? 'active' : ''}`} style={environment.doorState === 'open' ? { background: 'rgba(37,99,235,0.08)', borderColor: 'var(--accent)' } : {}}>
                        <input
                            type="radio"
                            name="doorState"
                            value="open"
                            checked={environment.doorState === 'open'}
                            onChange={e => setEnvironment(prev => ({ ...prev, doorState: e.target.value }))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>📖 開門 (內部)</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>優先渲染內部層板與配件</span>
                        </div>
                    </label>
                </div>

                {/* Prompt preview */}
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>AI Prompt</span>
                    <button
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => setShowPrompt(p => !p)}
                    >
                        {showPrompt ? '收合' : '展開'}
                    </button>
                </div>
                {showPrompt && (
                    <div style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: 12, marginBottom: 12,
                        fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
                        maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace'
                    }}>
                        {promptText}
                    </div>
                )}
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: 12 }} onClick={copyPrompt}>
                    📋 複製 Prompt
                </button>

                <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%' }}
                    onClick={handleRender}
                    disabled={loading || !hasSketch}
                >
                    {loading ? '🤖 AI 渲染中...' : '🎨 開始 AI 渲染'}
                </button>

                {result && (
                    <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => downloadResult(result)}>
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
                        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>通常需要 10-30 秒</p>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge badge-green">✓ 渲染完成</span>
                            <span className="badge badge-purple">Banana Pro</span>
                        </div>
                        <img
                            src={`data:${result.mimeType};base64,${result.imageData}`}
                            alt="AI 渲染效果圖"
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => downloadResult(result)} style={{ flex: 1 }}>
                                ⬇️ 另存效果圖
                            </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            由 Gemini 3 Pro Image (Banana Pro) 生成
                        </p>
                    </div>
                )}

                {/* Render history */}
                {history.length > 1 && (
                    <div style={{ width: '100%', maxWidth: 640 }}>
                        <div className="section-title">渲染歷史（最近 5 張）</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                            {history.slice(1).map((h, i) => (
                                <div
                                    key={h.timestamp}
                                    style={{
                                        borderRadius: 'var(--radius)', overflow: 'hidden',
                                        border: '1px solid var(--border)', background: 'var(--bg-surface)'
                                    }}
                                >
                                    <img
                                        src={`data:${h.mimeType};base64,${h.imageData}`}
                                        alt={`歷史 ${i + 1}`}
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                    <div style={{
                                        padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4,
                                        alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {new Date(h.timestamp).toLocaleTimeString('zh-TW')}
                                        </span>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ width: '100%', fontSize: 11, padding: '3px 6px' }}
                                            onClick={() => downloadResult(h)}
                                        >
                                            ⬇️ 另存
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
