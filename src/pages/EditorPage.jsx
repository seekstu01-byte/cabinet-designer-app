import React, { useState, useEffect, useRef, useCallback } from 'react'
import { textureService, projectService } from '../services/db'

const SCALE = 2.8 // pixels per cm
const PANEL_T = 6 // panel thickness in px
const KICK_H = 28 // kick plate height in px
const CEILING_H_PX = 36
const SPOTLIGHT_R = 18
const FLOOR_H_PX = 32
const PAD = { top: 20, left: 50, right: 40, bottom: 20 }

const ACCESSORY_TYPES = [
    { type: 'shelf', label: '層板', icon: '━', color: '#4b5563' },
    { type: 'drawer', label: '抽屜', icon: '▬', color: '#8b5cf6' },
    { type: 'door-left', label: '左開門', icon: '🚪', color: '#3b82f6' },
    { type: 'door-right', label: '右開門', icon: '🚪', color: '#2563eb' },
    { type: 'hanging-rod', label: '掛衣桿', icon: '〡', color: '#f59e0b' },
    { type: 'led', label: 'LED 燈條', icon: '💡', color: '#10b981' },
    { type: 'divider', label: '隔板', icon: '┃', color: '#e879f9' },
]

const FLOOR_TYPES = [
    { value: 'wood-dark', label: '深色木地板', colors: ['#5c3d2e', '#6b4835', '#7a5340'] },
    { value: 'wood-light', label: '淺色木地板', colors: ['#c4a882', '#d4b896', '#c9ab85'] },
    { value: 'tile', label: '磁磚', colors: ['#b8bcc0', '#cdd1d5', '#c2c6ca'] },
]

let _uid = 0
const uid = () => `${Date.now()}_${++_uid}`

/* ─── Canvas Drawing ─── */
function drawScene(canvas, cabinets, ceilingH, selectedIdx, selectedAccId, floorType) {
    const ctx = canvas.getContext('2d')
    const totalCabW = cabinets.reduce((s, c) => s + c.width * SCALE, 0)
    const gapBetween = 4
    const totalGaps = (cabinets.length - 1) * gapBetween
    const sceneW = PAD.left + totalCabW + totalGaps + PAD.right
    const sceneH = PAD.top + CEILING_H_PX + ceilingH * SCALE + FLOOR_H_PX + PAD.bottom

    const dpr = window.devicePixelRatio || 1
    canvas.width = sceneW * dpr
    canvas.height = sceneH * dpr
    canvas.style.width = sceneW + 'px'
    canvas.style.height = sceneH + 'px'
    ctx.scale(dpr, dpr)

    // Background — light
    ctx.fillStyle = '#f8f9fb'
    ctx.fillRect(0, 0, sceneW, sceneH)

    // Wall texture (subtle)
    ctx.fillStyle = 'rgba(0,0,0,0.018)'
    for (let y = PAD.top + CEILING_H_PX; y < sceneH - FLOOR_H_PX - PAD.bottom; y += 16) {
        ctx.fillRect(0, y, sceneW, 1)
    }

    const ceilingY = PAD.top
    const cabinetTopY = ceilingY + CEILING_H_PX

    // ─── Ceiling ───
    const ceilGrad = ctx.createLinearGradient(0, ceilingY, 0, ceilingY + CEILING_H_PX)
    ceilGrad.addColorStop(0, '#e2e5ea')
    ceilGrad.addColorStop(1, '#d1d5db')
    ctx.fillStyle = ceilGrad
    ctx.fillRect(PAD.left - 20, ceilingY, totalCabW + totalGaps + 40, CEILING_H_PX)
    ctx.strokeStyle = '#c0c5cc'
    ctx.lineWidth = 1
    ctx.strokeRect(PAD.left - 20, ceilingY, totalCabW + totalGaps + 40, CEILING_H_PX)

    // Ceiling label
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('天花板', PAD.left + (totalCabW + totalGaps) / 2, ceilingY + 14)

    // ─── Floor ───
    const floorY = cabinetTopY + ceilingH * SCALE
    const floorDef = FLOOR_TYPES.find(f => f.value === floorType) || FLOOR_TYPES[0]
    const stripW = 20
    for (let x = PAD.left - 20; x < PAD.left + totalCabW + totalGaps + 20; x += stripW) {
        const ci = Math.floor((x / stripW) % floorDef.colors.length)
        ctx.fillStyle = floorDef.colors[ci]
        ctx.fillRect(x, floorY, stripW - 1, FLOOR_H_PX)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(PAD.left - 20, floorY, totalCabW + totalGaps + 40, FLOOR_H_PX)

    // Floor label
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(floorDef.label, PAD.left + (totalCabW + totalGaps) / 2, floorY + FLOOR_H_PX / 2 + 3)

    // ─── Cabinets ───
    let xOff = PAD.left

    cabinets.forEach((cab, idx) => {
        const cw = cab.width * SCALE
        const ch = cab.height * SCALE
        const cy = cabinetTopY + (ceilingH - cab.height) * SCALE
        const isSelected = idx === selectedIdx

        // Spotlight cone
        const spotX = xOff + cw / 2
        const spotY = ceilingY + CEILING_H_PX
        const coneGrad = ctx.createRadialGradient(spotX, spotY, 2, spotX, spotY + 60, 80)
        coneGrad.addColorStop(0, 'rgba(251,191,36,0.15)')
        coneGrad.addColorStop(1, 'rgba(251,191,36,0)')
        ctx.fillStyle = coneGrad
        ctx.beginPath()
        ctx.moveTo(spotX - 4, spotY)
        ctx.lineTo(spotX - 50, spotY + 80)
        ctx.lineTo(spotX + 50, spotY + 80)
        ctx.lineTo(spotX + 4, spotY)
        ctx.closePath()
        ctx.fill()

        // Spotlight fixture
        ctx.fillStyle = '#64748b'
        ctx.beginPath()
        ctx.arc(spotX, spotY - 2, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(spotX, spotY - 2, 2, 0, Math.PI * 2)
        ctx.fill()

        // ─── Cabinet body ───
        // Back fill
        ctx.fillStyle = isSelected ? 'rgba(37,99,235,0.04)' : 'rgba(0,0,0,0.015)'
        ctx.fillRect(xOff + PANEL_T, cy + PANEL_T, cw - PANEL_T * 2, ch - PANEL_T - KICK_H)

        // Left panel
        ctx.fillStyle = isSelected ? '#2563eb' : '#6b7280'
        ctx.fillRect(xOff, cy, PANEL_T, ch - KICK_H)
        // Right panel
        ctx.fillRect(xOff + cw - PANEL_T, cy, PANEL_T, ch - KICK_H)
        // Top panel
        ctx.fillRect(xOff, cy, cw, PANEL_T)
        // Bottom panel (above kick)
        ctx.fillRect(xOff, cy + ch - KICK_H - PANEL_T, cw, PANEL_T)

        // Kick plate
        ctx.fillStyle = isSelected ? 'rgba(37,99,235,0.12)' : 'rgba(0,0,0,0.06)'
        ctx.fillRect(xOff + 10, cy + ch - KICK_H, cw - 20, KICK_H)
        ctx.strokeStyle = isSelected ? '#2563eb' : '#9ca3af'
        ctx.lineWidth = 0.5
        ctx.strokeRect(xOff + 10, cy + ch - KICK_H, cw - 20, KICK_H)

        // Selection glow
        if (isSelected) {
            ctx.shadowColor = 'rgba(37,99,235,0.25)'
            ctx.shadowBlur = 12
            ctx.strokeStyle = '#2563eb'
            ctx.lineWidth = 2
            ctx.strokeRect(xOff - 1, cy - 1, cw + 2, ch + 2)
            ctx.shadowBlur = 0
        }

        // ─── Accessories ───
        const innerX = xOff + PANEL_T
        const innerW = cw - PANEL_T * 2
        const innerTop = cy + PANEL_T
        const innerH = ch - PANEL_T * 2 - KICK_H

        cab.accessories?.forEach(acc => {
            const ay = innerTop + (acc.y / cab.height) * innerH
            const ah = (acc.height / cab.height) * innerH
            const isAccSel = acc.id === selectedAccId

            if (isAccSel) {
                ctx.shadowColor = 'rgba(124,58,237,0.3)'
                ctx.shadowBlur = 8
            }

            switch (acc.type) {
                case 'shelf': {
                    ctx.fillStyle = isAccSel ? '#374151' : '#6b7280'
                    ctx.fillRect(innerX, ay - 2, innerW, 4)
                    // shelf brackets
                    ctx.fillStyle = '#9ca3af'
                    ctx.fillRect(innerX + 6, ay - 6, 3, 8)
                    ctx.fillRect(innerX + innerW - 9, ay - 6, 3, 8)
                    break
                }
                case 'drawer': {
                    const dh = Math.max(ah, 16)
                    ctx.fillStyle = isAccSel ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.06)'
                    ctx.strokeStyle = isAccSel ? '#7c3aed' : '#8b5cf6'
                    ctx.lineWidth = 1.5
                    ctx.beginPath()
                    ctx.roundRect(innerX + 2, ay, innerW - 4, dh, 2)
                    ctx.fill()
                    ctx.stroke()
                    // handle
                    const handleY = ay + dh / 2
                    ctx.strokeStyle = isAccSel ? '#6d28d9' : '#7c3aed'
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.moveTo(innerX + innerW * 0.35, handleY)
                    ctx.lineTo(innerX + innerW * 0.65, handleY)
                    ctx.stroke()
                    break
                }
                case 'door-left':
                case 'door-right': {
                    const isLeft = acc.type === 'door-left'
                    ctx.fillStyle = isAccSel ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.03)'
                    ctx.strokeStyle = isAccSel ? '#2563eb' : '#3b82f6'
                    ctx.lineWidth = 1.5
                    ctx.beginPath()
                    ctx.roundRect(innerX + 2, innerTop, innerW - 4, innerH, 2)
                    ctx.fill()
                    ctx.stroke()
                    // handle
                    const hx = isLeft ? innerX + innerW - 14 : innerX + 8
                    ctx.strokeStyle = isAccSel ? '#1d4ed8' : '#2563eb'
                    ctx.lineWidth = 2.5
                    ctx.beginPath()
                    ctx.moveTo(hx, innerTop + innerH * 0.42)
                    ctx.lineTo(hx, innerTop + innerH * 0.58)
                    ctx.stroke()
                    // hinge dots
                    const hingeX = isLeft ? innerX + 6 : innerX + innerW - 8
                    ctx.fillStyle = '#9ca3af'
                    ctx.beginPath()
                    ctx.arc(hingeX, innerTop + 16, 2, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.beginPath()
                    ctx.arc(hingeX, innerTop + innerH - 16, 2, 0, Math.PI * 2)
                    ctx.fill()
                    break
                }
                case 'hanging-rod': {
                    ctx.strokeStyle = isAccSel ? '#d97706' : '#f59e0b'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.moveTo(innerX + 10, ay)
                    ctx.lineTo(innerX + innerW - 10, ay)
                    ctx.stroke()
                    // brackets
                    ctx.strokeStyle = '#9ca3af'
                    ctx.lineWidth = 1.5
                    ctx.beginPath()
                    ctx.moveTo(innerX + 10, ay)
                    ctx.lineTo(innerX + 10, ay - 10)
                    ctx.moveTo(innerX + innerW - 10, ay)
                    ctx.lineTo(innerX + innerW - 10, ay - 10)
                    ctx.stroke()
                    break
                }
                case 'led': {
                    ctx.fillStyle = isAccSel ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.5)'
                    ctx.fillRect(innerX + 2, ay, innerW - 4, 2)
                    // glow
                    const ledGlow = ctx.createLinearGradient(0, ay - 6, 0, ay + 8)
                    ledGlow.addColorStop(0, 'rgba(16,185,129,0)')
                    ledGlow.addColorStop(0.5, 'rgba(16,185,129,0.08)')
                    ledGlow.addColorStop(1, 'rgba(16,185,129,0)')
                    ctx.fillStyle = ledGlow
                    ctx.fillRect(innerX, ay - 6, innerW, 14)
                    break
                }
                case 'divider': {
                    const dx = innerX + (acc.x / cab.width) * innerW
                    ctx.fillStyle = isAccSel ? '#e879f9' : '#c084fc'
                    ctx.fillRect(dx - 2, innerTop, 4, innerH)
                    ctx.strokeStyle = isAccSel ? '#f0abfc' : '#a855f7'
                    ctx.lineWidth = 0.5
                    ctx.strokeRect(dx - 2, innerTop, 4, innerH)
                    break
                }
            }
            ctx.shadowBlur = 0
        })

        // ─── Dimension labels ───
        ctx.fillStyle = '#6b7280'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'center'

        // Width label (top)
        drawDimLine(ctx, xOff, cy - 14, xOff + cw, cy - 14, `${cab.width}cm`)

        // Height label (right)
        ctx.save()
        ctx.translate(xOff + cw + 18, cy + (ch - KICK_H) / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillStyle = '#6b7280'
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${cab.height}cm`, 0, 0)
        ctx.restore()

        // Cabinet index
        ctx.fillStyle = '#9ca3af'
        ctx.font = '10px Inter'
        ctx.textAlign = 'center'
        ctx.fillText(`#${idx + 1}`, xOff + cw / 2, cy + ch + 14)

        xOff += cw + gapBetween
    })

    // ─── Total width dimension ───
    if (cabinets.length > 1) {
        const totalW = cabinets.reduce((s, c) => s + c.width, 0)
        const totalPx = totalCabW + totalGaps
        const dimY = cabinetTopY + ceilingH * SCALE + FLOOR_H_PX + 14
        drawDimLine(ctx, PAD.left, dimY, PAD.left + totalPx, dimY, `總寬 ${totalW}cm`)
    }

    // ─── Ceiling height dimension (left) ───
    ctx.save()
    ctx.translate(16, cabinetTopY + (ceilingH * SCALE) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px Inter'
    ctx.textAlign = 'center'
    ctx.fillText(`天花板高 ${ceilingH}cm`, 0, 0)
    ctx.restore()
}

function drawDimLine(ctx, x1, y, x2, y2, label) {
    ctx.strokeStyle = '#4a6080'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    // Ticks
    ctx.moveTo(x1, y - 4)
    ctx.lineTo(x1, y + 4)
    ctx.moveTo(x2, y - 4)
    ctx.lineTo(x2, y + 4)
    // Line
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
    // Label
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const midX = (x1 + x2) / 2
    // White bg for readability
    const tw = ctx.measureText(label).width
    ctx.fillStyle = '#f8f9fb'
    ctx.fillRect(midX - tw / 2 - 4, y - 7, tw + 8, 14)
    ctx.fillStyle = '#6b7280'
    ctx.fillText(label, midX, y)
    ctx.textBaseline = 'alphabetic'
}

function exportCanvasAsJpeg(canvas) {
    const link = document.createElement('a')
    link.download = `cabinet-sketch-${Date.now()}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
}

export default function EditorPage({ toast }) {
    const canvasRef = useRef(null)
    const [ceilingH, setCeilingH] = useState(240)
    const [selectedIdx, setSelectedIdx] = useState(0)
    const [selectedAccId, setSelectedAccId] = useState(null)
    const [floorType, setFloorType] = useState('wood-dark')
    const [cabinets, setCabinets] = useState([
        { id: 1, width: 60, height: 220, accessories: [] }
    ])
    const [textures, setTextures] = useState([])
    const [materials, setMaterials] = useState({ exterior: '', interior: '', door: '', drawer: '' })
    const [projectName, setProjectName] = useState('未命名專案')
    const [projectId, setProjectId] = useState(null)
    const [showLoadModal, setShowLoadModal] = useState(false)
    const [savedProjects, setSavedProjects] = useState([])

    useEffect(() => {
        textureService.getAll().then(setTextures)
    }, [])

    const redraw = useCallback(() => {
        if (canvasRef.current) {
            drawScene(canvasRef.current, cabinets, ceilingH, selectedIdx, selectedAccId, floorType)
        }
    }, [cabinets, ceilingH, selectedIdx, selectedAccId, floorType])

    useEffect(() => { redraw() }, [redraw])

    const addCabinet = () => {
        const newCab = { id: uid(), width: 60, height: 220, accessories: [] }
        setCabinets(prev => [...prev, newCab])
        setSelectedIdx(cabinets.length)
        setSelectedAccId(null)
    }

    const removeCabinet = (idx) => {
        if (cabinets.length <= 1) { toast('至少需要一個櫃體', 'error'); return }
        setCabinets(prev => prev.filter((_, i) => i !== idx))
        setSelectedIdx(Math.max(0, idx - 1))
        setSelectedAccId(null)
    }

    const updateCabinet = (field, value) => {
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, [field]: Number(value) } : c
        ))
    }

    const addAccessory = (type) => {
        const cab = cabinets[selectedIdx]
        const defaults = {
            'shelf': { type: 'shelf', y: cab.height / 2, height: 2, x: 0 },
            'drawer': { type: 'drawer', y: cab.height * 0.7, height: 20, x: 0 },
            'door-left': { type: 'door-left', y: 0, height: cab.height, x: 0 },
            'door-right': { type: 'door-right', y: 0, height: cab.height, x: 0 },
            'hanging-rod': { type: 'hanging-rod', y: cab.height * 0.35, height: 4, x: 0 },
            'led': { type: 'led', y: 8, height: 2, x: 0 },
            'divider': { type: 'divider', y: 0, height: cab.height, x: cab.width / 2 },
        }
        const acc = { id: uid(), ...defaults[type] }
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, accessories: [...(c.accessories || []), acc] } : c
        ))
        setSelectedAccId(acc.id)
    }

    const updateAccessory = (accId, field, value) => {
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx
                ? {
                    ...c,
                    accessories: c.accessories.map(a =>
                        a.id === accId ? { ...a, [field]: Number(value) } : a
                    )
                } : c
        ))
    }

    const removeAccessory = (accId) => {
        setCabinets(prev => prev.map((c, i) =>
            i === selectedIdx ? { ...c, accessories: c.accessories.filter(a => a.id !== accId) } : c
        ))
        if (selectedAccId === accId) setSelectedAccId(null)
    }

    const saveProject = async () => {
        try {
            const data = { cabinets, ceilingH, floorType, materials }
            const newId = await projectService.save({
                ...(projectId ? { id: projectId } : {}),
                name: projectName,
                data
            })
            if (newId) setProjectId(newId)
            toast('💾 專案已儲存', 'success')
        } catch {
            toast('儲存失敗', 'error')
        }
    }

    const loadProject = async (proj) => {
        const d = proj.data
        if (d.cabinets) setCabinets(d.cabinets)
        if (d.ceilingH) setCeilingH(d.ceilingH)
        if (d.floorType) setFloorType(d.floorType)
        if (d.materials) setMaterials(d.materials)
        setProjectName(proj.name)
        setProjectId(proj.id)
        setShowLoadModal(false)
        setSelectedIdx(0)
        setSelectedAccId(null)
        toast(`已載入「${proj.name}」`, 'success')
    }

    const openLoadModal = async () => {
        const projects = await projectService.getAll()
        setSavedProjects(projects)
        setShowLoadModal(true)
    }

    const doExport = () => {
        if (canvasRef.current) {
            exportCanvasAsJpeg(canvasRef.current)
            // Save to sessionStorage for renderer
            sessionStorage.setItem('cabinet_sketch', canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1])
            sessionStorage.setItem('cabinet_materials', JSON.stringify(materials))
            sessionStorage.setItem('cabinet_config', JSON.stringify({
                cabinets, ceilingH, floorType, materials
            }))
            toast('線稿已匯出，資訊已傳送至 AI 渲染頁', 'success')
        }
    }

    const cab = cabinets[selectedIdx] || cabinets[0]
    const selAcc = cab?.accessories?.find(a => a.id === selectedAccId)
    const accDef = selAcc ? ACCESSORY_TYPES.find(t => t.type === selAcc.type) : null

    return (
        <div className="editor-layout">
            {/* ─── Sidebar ─── */}
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
                                onClick={() => { setSelectedIdx(idx); setSelectedAccId(null) }}
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

                {/* Dimensions */}
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
                            <input type="range" min="30" max="120" value={cab.width} onChange={e => updateCabinet('width', e.target.value)} />
                        </div>
                        <div className="slider-group">
                            <div className="slider-label">
                                <span>高度</span>
                                <span className="slider-value">{cab.height} cm</span>
                            </div>
                            <input type="range" min="30" max="260" value={cab.height} onChange={e => updateCabinet('height', e.target.value)} />
                        </div>
                    </>}
                </div>

                {/* Floor type */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">地板材質</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {FLOOR_TYPES.map(f => (
                            <button
                                key={f.value}
                                className={`btn btn-sm ${floorType === f.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFloorType(f.value)}
                                style={{ fontSize: 12 }}
                            >
                                <div style={{
                                    width: 14, height: 14, borderRadius: 3, marginRight: 4,
                                    background: f.colors[0], display: 'inline-block', verticalAlign: 'middle'
                                }} />
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Accessories */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">新增配件</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {ACCESSORY_TYPES.map(a => (
                            <button key={a.type} className="btn btn-secondary btn-sm" onClick={() => addAccessory(a.type)} style={{ fontSize: 12 }}>
                                <span style={{ color: a.color }}>{a.icon}</span> {a.label}
                            </button>
                        ))}
                    </div>
                    {cab?.accessories?.length > 0 && (
                        <div className="accessory-list">
                            {cab.accessories.map(acc => {
                                const def = ACCESSORY_TYPES.find(a => a.type === acc.type)
                                return (
                                    <div
                                        key={acc.id}
                                        className="accessory-item"
                                        style={{
                                            borderColor: acc.id === selectedAccId ? def?.color : 'var(--border)',
                                            background: acc.id === selectedAccId ? 'rgba(139,92,246,0.08)' : 'var(--bg-elevated)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setSelectedAccId(acc.id === selectedAccId ? null : acc.id)}
                                    >
                                        <span className="accessory-item-name" style={{ color: def?.color }}>
                                            {def?.icon} {def?.label}
                                            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>
                                                Y:{Math.round(acc.y)}
                                                {acc.type === 'divider' ? ` X:${Math.round(acc.x)}` : ` H:${Math.round(acc.height)}`}
                                            </span>
                                        </span>
                                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); removeAccessory(acc.id) }}>×</button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Selected accessory properties */}
                {selAcc && (
                    <div className="editor-sidebar-section">
                        <div className="editor-sidebar-section-title" style={{ color: accDef?.color }}>
                            {accDef?.icon} {accDef?.label} 屬性
                        </div>
                        <div className="slider-group">
                            <div className="slider-label">
                                <span>Y 位置</span>
                                <span className="slider-value">{Math.round(selAcc.y)} cm</span>
                            </div>
                            <input type="range" min="0" max={cab.height} value={selAcc.y}
                                onChange={e => updateAccessory(selAcc.id, 'y', e.target.value)}
                                style={{ accentColor: accDef?.color }}
                            />
                        </div>
                        {selAcc.type === 'divider' ? (
                            <div className="slider-group">
                                <div className="slider-label">
                                    <span>X 位置</span>
                                    <span className="slider-value">{Math.round(selAcc.x)} cm</span>
                                </div>
                                <input type="range" min="2" max={cab.width - 2} value={selAcc.x}
                                    onChange={e => updateAccessory(selAcc.id, 'x', e.target.value)}
                                    style={{ accentColor: accDef?.color }}
                                />
                            </div>
                        ) : selAcc.type !== 'shelf' && selAcc.type !== 'led' && selAcc.type !== 'hanging-rod' && (
                            <div className="slider-group">
                                <div className="slider-label">
                                    <span>高度</span>
                                    <span className="slider-value">{Math.round(selAcc.height)} cm</span>
                                </div>
                                <input type="range" min="5" max={cab.height} value={selAcc.height}
                                    onChange={e => updateAccessory(selAcc.id, 'height', e.target.value)}
                                    style={{ accentColor: accDef?.color }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Material assignment */}
                <div className="editor-sidebar-section">
                    <div className="editor-sidebar-section-title">材質分配</div>
                    {textures.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            請先在後台上傳材質
                        </p>
                    )}
                    {['exterior', 'interior', 'door', 'drawer'].map(zone => (
                        <div key={zone} className="form-group" style={{ marginBottom: 10 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>
                                {{ exterior: '外部面板', interior: '內部', door: '門片', drawer: '抽屜面板' }[zone]}
                            </label>
                            {textures.length > 0 ? (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {textures.slice(0, 6).map(t => (
                                        <div
                                            key={t.id}
                                            style={{
                                                width: 36, height: 36, borderRadius: 6, overflow: 'hidden',
                                                border: `2px solid ${materials[zone] === t.name ? 'var(--accent)' : 'var(--border)'}`,
                                                cursor: 'pointer', transition: 'var(--transition)'
                                            }}
                                            title={t.name}
                                            onClick={() => setMaterials(m => ({ ...m, [zone]: t.name }))}
                                        >
                                            <img src={t.dataUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                    <div
                                        style={{
                                            width: 36, height: 36, borderRadius: 6,
                                            border: `2px solid ${materials[zone] === '' ? 'var(--accent)' : 'var(--border)'}`,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-elevated)'
                                        }}
                                        onClick={() => setMaterials(m => ({ ...m, [zone]: '' }))}
                                    >
                                        無
                                    </div>
                                </div>
                            ) : (
                                <select className="form-select" value={materials[zone]} onChange={e => setMaterials(m => ({ ...m, [zone]: e.target.value }))} style={{ fontSize: 12 }}>
                                    <option value="">— 選擇材質 —</option>
                                    {textures.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                            )}
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

            {/* ─── Canvas area ─── */}
            <div className="editor-canvas-area">
                <div className="editor-canvas-toolbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            className="form-input"
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            style={{ width: 140, padding: '4px 8px', fontSize: 13, background: 'var(--bg-elevated)' }}
                        />
                        <button className="btn btn-sm btn-primary" onClick={saveProject} style={{ padding: '4px 10px', fontSize: 12 }}>
                            💾 儲存
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={openLoadModal} style={{ padding: '4px 10px', fontSize: 12 }}>
                            📂 載入
                        </button>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>
                        {cabinets.length} 個並排 | 天花板 {ceilingH}cm | 總寬 {cabinets.reduce((s, c) => s + c.width, 0)}cm
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <span className="badge badge-blue">正視圖</span>
                        <span className="badge badge-green">即時預覽</span>
                    </div>
                </div>
                <div className="editor-canvas-wrapper">
                    <canvas
                        ref={canvasRef}
                        style={{ borderRadius: 8, boxShadow: 'var(--shadow-lg)', cursor: 'crosshair' }}
                        onClick={(e) => {
                            const rect = canvasRef.current.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            let xOff = PAD.left
                            const gapBetween = 4
                            for (let i = 0; i < cabinets.length; i++) {
                                const cw = cabinets[i].width * SCALE
                                if (x >= xOff && x <= xOff + cw) {
                                    setSelectedIdx(i)
                                    setSelectedAccId(null)
                                    break
                                }
                                xOff += cw + gapBetween
                            }
                        }}
                    />
                </div>
            </div>

            {/* Load modal */}
            {showLoadModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setShowLoadModal(false)}>
                    <div className="card" style={{ width: 400, maxHeight: 500, overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📂 載入專案</h3>
                        {savedProjects.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>尚無已儲存的專案</p>
                        ) : (
                            savedProjects.map(p => (
                                <div
                                    key={p.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 12px', borderRadius: 'var(--radius)',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                        marginBottom: 8, cursor: 'pointer', transition: 'var(--transition)'
                                    }}
                                    onClick={() => loadProject(p)}
                                >
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {new Date(p.updatedAt).toLocaleString('zh-TW')}
                                        </div>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={async (e) => {
                                        e.stopPropagation()
                                        await projectService.delete(p.id)
                                        setSavedProjects(prev => prev.filter(x => x.id !== p.id))
                                        toast('已刪除', 'info')
                                    }}>刪除</button>
                                </div>
                            ))
                        )}
                        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowLoadModal(false)}>關閉</button>
                    </div>
                </div>
            )}
        </div>
    )
}
