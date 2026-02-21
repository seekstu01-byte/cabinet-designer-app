import React, { useState, useEffect, useRef } from 'react'
import { textureService } from '../../services/db'

const CATEGORIES = ['全部', '木紋', '石紋', '純色', '布紋', '其他']

function validateFilename(filename) {
    // Expected: 空間名稱-材質-編號.png/jpg
    return /^.+-.+-.+\.(png|jpg|jpeg)$/i.test(filename)
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export default function TextureManager({ toast }) {
    const [textures, setTextures] = useState([])
    const [filterCat, setFilterCat] = useState('全部')
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    const loadTextures = async () => {
        const all = await textureService.getAll()
        setTextures(all)
    }

    useEffect(() => { loadTextures() }, [])

    const handleFiles = async (files) => {
        setUploading(true)
        let success = 0, errors = 0
        for (const file of files) {
            if (!validateFilename(file.name)) {
                toast(`檔名格式錯誤：${file.name}（應為：空間名稱-材質-編號.png）`, 'error')
                errors++
                continue
            }
            if (!file.type.startsWith('image/')) {
                toast(`${file.name} 不是圖片格式`, 'error')
                errors++
                continue
            }

            const parts = file.name.replace(/\.[^.]+$/, '').split('-')
            const category = parts.length >= 2 ? parts[1] : '其他'
            const dataUrl = await fileToBase64(file)

            await textureService.add({
                name: file.name.replace(/\.[^.]+$/, ''),
                filename: file.name,
                category,
                dataUrl
            })
            success++
        }
        await loadTextures()
        setUploading(false)
        if (success > 0) toast(`成功上傳 ${success} 個材質`, 'success')
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles([...e.dataTransfer.files])
    }

    const handleDelete = async (id) => {
        await textureService.delete(id)
        await loadTextures()
        toast('材質已刪除', 'info')
    }

    const filtered = filterCat === '全部' ? textures : textures.filter(t => t.category === filterCat)

    return (
        <div style={{ maxWidth: 720 }}>
            {/* Upload zone */}
            <div
                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                style={{ marginBottom: 20 }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="upload-zone-icon">🖼</div>
                <div className="upload-zone-text">{uploading ? '上傳中...' : '拖曳圖片到此，或點擊選擇'}</div>
                <div className="upload-zone-hint">
                    檔名格式：<code style={{ color: 'var(--accent)' }}>空間名稱-材質-編號.png</code><br />
                    例如：<code style={{ color: 'var(--text-muted)' }}>客廳-橡木-001.png</code>、<code style={{ color: 'var(--text-muted)' }}>臥室-白色-002.jpg</code>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={e => handleFiles([...e.target.files])}
                />
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`btn btn-sm ${filterCat === cat ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterCat(cat)}
                    >
                        {cat} {cat === '全部' ? `(${textures.length})` : `(${textures.filter(t => t.category === cat).length})`}
                    </button>
                ))}
            </div>

            {/* Texture grid */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    {textures.length === 0 ? '尚未上傳任何材質' : '此分類無材質'}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    {filtered.map(t => (
                        <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                <img src={t.dataUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    {t.name}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="badge badge-blue" style={{ fontSize: 10 }}>{t.category}</span>
                                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handleDelete(t.id)}>刪除</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
