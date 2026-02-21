import React, { useState, useEffect, useRef, useCallback } from 'react'
import { textureService } from '../services/db'

const SCALE = 3 // pixels per cm
const RULER_SIZE = 24

const ACCESSORY_TYPES = [
    { type: 'shelf', label: '層板', icon: '━', color: '#64748b' },
    { type: 'drawer', label: '抽屜', icon: '▬', color: '#8b5cf6' },
    { type: 'door', label: '門片', icon: '🚪', color: '#3b82f6' },
    { type: 'hanging-rod', label: '掛衣桿', icon: '〡', color: '#f59e0b' },
    { type: 'led', label: 'LED 燈條', icon: '💡', color: '#10b981' }
]

function drawCabinetCanvas(canvas, cabinets, ceilingH, selectedIdx) {
    const ctx = canvas.getContext('2d')
    const totalWidth = cabinets.reduce((s, c) => s + c.width, 0) * SCALE + RULER_SIZE + 40
    const totalHeight = ceilingH * SCALE + RULER_SIZE + 40

    canvas.width = totalWidth
    canvas.height = totalHeight

    // Background
    ctx.fillStyle = '#1e2a3a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Ceiling line
    ctx.strokeStyle = '#94a3b8'
    ctx.setLineDash([6, 3])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(RULER_SIZE, RULER_SIZE)
    ctx.lineTo(canvas.width - 20, RULER_SIZE)
    ctx.stroke()
    ctx.setLineDash([])

    let xOffset = RULER_SIZE + 20

    cabinets.forEach((cab, idx) => {
        const cw = cab.width * SCALE
        const ch = cab.height * SCALE
        const cy = RULER_SIZE + (ceilingH - cab.height) * SCALE

        const isSelected = idx === selectedIdx

        // Cabinet body
        ctx.fillStyle = isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)'
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#334155'
        ctx.lineWidth = isSelected ? 2 : 1.5
        ctx.beginPath()
        ctx.roundRect(xOffset, cy, cw, ch, 2)
        ctx.fill()
        ctx.stroke()

        // Inner frame (simulate side panels)
        ctx.strokeStyle = isSelected ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        const inset = 8
        ctx.strokeRect(xOffset + inset, cy + inset, cw - inset * 2, ch - inset * 2)

        // Draw accessories
        cab.accessories?.forEach(acc => {
            const ay = cy + acc.y * SCALE
            const ah = acc.height * SCALE
            switch (acc.type) {
                case 'shelf':
                    ctx.fillStyle = '#64748b'
                    ctx.fillRect(xOffset + inset, ay, cw - inset * 2, 3)
                    break
                case 'drawer': {
                    ctx.fillStyle = 'rgba(139,92,246,0.2)'
                    ctx.strokeStyle = '#8b5cf6'
                    ctx.lineWidth = 1
                    ctx.strokeRect(xOffset + inset, ay, cw - inset * 2, ah)
                    ctx.strokeStyle = '#8b5cf6'
                    ctx.lineWidth = 0.5
                    const mid = ay + ah / 2
                    ctx.beginPath()
                    ctx.moveTo(xOffset + cw * 0.35, mid)
                    ctx.lineTo(xOffset + cw * 0.65, mid)
                    ctx.stroke()
                    break
                }
                case 'door': {
                    ctx.fillStyle = 'rgba(59,130,246,0.08)'
                    ctx.strokeStyle = '#3b82f6'
                    ctx.lineWidth = 1.5
                    ctx.strokeRect(xOffset + inset, cy + inset, cw - inset * 2, ch - inset * 2)
                    // Handle
                    const hx = acc.opening === 'left' ? xOffset + cw - inset - 10 : xOffset + inset + 4
                    ctx.beginPath()
                    ctx.moveTo(hx, cy + ch * 0.4)
                    ctx.lineTo(hx, cy + ch * 0.6)
                    ctx.strokeStyle = '#94a3b8'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    break
                }
                case 'hanging-rod':
                    ctx.strokeStyle = '#f59e0b'
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.moveTo(xOffset + inset + 4, ay)
                    ctx.lineTo(xOffset + cw - inset - 4, ay)
                    ctx.stroke()
                    break
                case 'led':
                    ctx.fillStyle = 'rgba(16,185,129,0.6)'
                    ctx.fillRect(xOffset + inset, ay, cw - inset * 2, 2)
                    break
            }
        })

        // Dimension label - width
        ctx.fillStyle = '#64748b'
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${cab.width}cm`, xOffset + cw / 2, cy - 8)

        // Dimension label - height (right side)
        ctx.save()
        ctx.translate(xOffset + cw + 8, cy + ch / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(`${cab.height}cm`, 0, 0)
        ctx.restore()

        // Cabinet label
        ctx.fillStyle = '#475569'
        ctx.font = '9px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`#${idx + 1}`, xOffset + cw / 2, cy + ch - 10)

        xOffset += cw + 12
    })

    // Ceiling height label
    ctx.fillStyle = '#475569'
    ctx.font = '10px Inter'
    ctx.textAlign = 'right'
    ctx.fillText(`天花板 ${ceilingH}cm`, RULER_SIZE - 2, RULER_SIZE + 4)
}

function exportCanvasAsJpeg(canvas) {
    const link = document.createElement('a')
    link.download = 'cabinet-sketch.jpg'
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
}

export default function EditorPage({ toast }) {
    const canvasRef = useRef(null)
    const [ceilingH, setCeilingH] = useState(240)
    const [selectedIdx, setSelectedIdx] = useState(0)
    const [cabinets, setCabinets] = useState([
        { id: 1, width: 60, height: 220, accessories: [] }
    ])
    const [textures, setTextures] = useState([])
    const [materials, setMaterials] = useState({ exterior: '', interior: '', door: '', drawer: '' })

    useEffect(() => {
        textureService.getAll().then(setTextures)
    }, [])

    const redraw = useCallback(() => {
        if (canvasRef.current) {
            drawCabinetCanvas(canvasRef.current, cabinets, ceilingH, selectedIdx)
        }
    }, [cabinets, ceilingH, selectedIdx])

    useEffect(() => { redraw() }, [redraw])

    const addCabinet = () => {
        const newCab = { id: Date.now(), width: 60, height: 220, accessories: [] }
        setCabinets(prev => [...prev, newCab])
        setSelectedIdx(cabinets.length)
    }

    const removeCabinet = (idx) => {
        if (cabinets.length <= 1) { toast('至少需要一個櫃體', 'error'); return }
        setCabinets(prev => prev.filter((_, i) => i !== idx))
        setSelectedIdx(Math.max(0, idx - 1))
    }

    const updateCabinet = (field, value) => {
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, [field]: Number(value) } : c
        ))
    }

    const addAccessory = (type) => {
        const cab = cabinets[selectedIdx]
        const defaults = {
            shelf: { type: 'shelf', y: cab.height / 2, height: 2 },
            drawer: { type: 'drawer', y: cab.height * 0.6, height: 20 },
            door: { type: 'door', y: 0, height: cab.height, opening: 'left' },
            'hanging-rod': { type: 'hanging-rod', y: cab.height * 0.4, height: 4 },
            led: { type: 'led', y: 10, height: 2 }
        }
        const acc = { id: Date.now(), ...defaults[type] }
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, accessories: [...(c.accessories || []), acc] } : c
        ))
    }

    const removeAccessory = (accId) => {
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, accessories: c.accessories.filter(a => a.id !== accId) } : c
        ))
    }

    const doExport = () => {
        if (canvasRef.current) {
            exportCanvasAsJpeg(canvasRef.current)
            // Save materials + sketch to sessionStorage for renderer
            sessionStorage.setItem('cabinet_sketch', canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1])
            sessionStorage.setItem('cabinet_materials', JSON.stringify(materials))
            toast('線稿已匯出，材質資訊已傳送至 AI 渲染', 'success')
        }
    }

    const cab = cabinets[selectedIdx] || cabinets[0]

    return (
        <div className="editor-layout">
            {/* Sidebar */}
            <aside className="editor-sidebar">
                {/* Cabinet list */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">櫃體列表</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {cabinets.map((c, idx) => (
                            <div
                                key={c.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 10px', borderRadius: 'var(--radius)',
                                    background: idx === selectedIdx ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)',
                                    border: `1px solid ${idx === selectedIdx ? 'var(--accent)' : 'var(--border)'}`,
                                    cursor: 'pointer', transition: 'var(--transition)'
                                }}
                                onClick={() => setSelectedIdx(idx)}
                            >
                                <span style={{ fontSize: 13, color: idx === selectedIdx ? 'var(--accent)' : 'var(--text-primary)' }}>
                                    🗄 櫃體 #{idx + 1} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.width}×{c.height}</span>
                                </span>
                                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); removeCabinet(idx) }}>×</button>
                            </div>
                        ))}
                    </div>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={addCabinet}>
                        + 新增櫃體
                    </button>
                </div>

                {/* Cabinet dimensions */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">尺寸設定</div>
                    <div className="slider-group">
                        <div className="slider-label">
                            <span>天花板高度</span>
                            <span className="slider-value">{ceilingH} cm</span>
                        </div>
                        <input type="range" min="200" max="300" value={ceilingH} onChange={e => setCeilingH(Number(e.target.value))} />
                    </div>
                    {cab && <>
                        <div className="slider-group">
                            <div className="slider-label">
                                <span>寬度</span>
                                <span className="slider-value">{cab.width} cm</span>
                            </div>
                            <input type="range" min="30" max="90" value={cab.width} onChange={e => updateCabinet('width', e.target.value)} />
                        </div>
                        <div className="slider-group">
                            <div className="slider-label">
                                <span>高度</span>
                                <span className="slider-value">{cab.height} cm</span>
                            </div>
                            <input type="range" min="30" max="240" value={cab.height} onChange={e => updateCabinet('height', e.target.value)} />
                        </div>
                    </>}
                </div>

                {/* Accessories */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">新增配件</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {ACCESSORY_TYPES.map(a => (
                            <button key={a.type} className="btn btn-secondary btn-sm" onClick={() => addAccessory(a.type)}>
                                {a.icon} {a.label}
                            </button>
                        ))}
                    </div>
                    {cab?.accessories?.length > 0 && (
                        <div className="accessory-list">
                            {cab.accessories.map(acc => {
                                const def = ACCESSORY_TYPES.find(a => a.type === acc.type)
                                return (
                                    <div key={acc.id} className="accessory-item">
                                        <span className="accessory-item-name">{def?.icon} {def?.label}</span>
                                        <button className="btn btn-danger btn-sm" onClick={() => removeAccessory(acc.id)}>×</button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Material assignment */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">材質分配</div>
                    {textures.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            請先在後台上傳材質
                        </p>
                    )}
                    {['exterior', 'interior', 'door', 'drawer'].map(zone => (
                        <div key={zone} className="form-group">
                            <label className="form-label">
                                {{ exterior: '外部面板', interior: '內部', door: '門片', drawer: '抽屜面板' }[zone]}
                            </label>
                            <select className="form-select" value={materials[zone]} onChange={e => setMaterials(m => ({ ...m, [zone]: e.target.value }))}>
                                <option value="">— 選擇材質 —</option>
                                {textures.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                {/* Export */}
                <div className="editor-sidebar-section">
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={doExport}>
                        📤 匯出線稿 + 送至渲染
                    </button>
                </div>
            </aside>

            {/* Canvas area */}
            <div className="editor-canvas-area">
                <div className="editor-canvas-toolbar">
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        系統：{cabinets.length} 個並排 | 天花板 {ceilingH}cm | 總寬 {cabinets.reduce((s, c) => s + c.width, 0)}cm
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <span className="badge badge-blue">正視圖</span>
                        <span className="badge badge-green">即時預覽</span>
                    </div>
                </div>
                <div className="editor-canvas-wrapper">
                    <canvas ref={canvasRef} style={{ borderRadius: 8, boxShadow: 'var(--shadow-lg)' }} onClick={(e) => {
                        const rect = canvasRef.current.getBoundingClientRect()
                        const x = e.clientX - rect.left
                        let xOff = RULER_SIZE + 20
                        for (let i = 0; i < cabinets.length; i++) {
                            const cw = cabinets[i].width * SCALE
                            if (x >= xOff && x <= xOff + cw) { setSelectedIdx(i); break }
                            xOff += cw + 12
                        }
                    }} />
                </div>
            </div>
        </div>
    )
}
