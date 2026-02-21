/**
 * Gemini API service for AI image generation
 */

const GEMINI_MODEL = 'gemini-2.0-flash-exp'

export async function generateCabinetRender({ apiKey, imageBase64, prompt }) {
    if (!apiKey) throw new Error('請先在後台設定 Gemini API Key')

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

    const parts = []

    // Add the sketch image if available
    if (imageBase64) {
        parts.push({
            inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64
            }
        })
    }

    parts.push({ text: prompt })

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
                temperature: 1,
                topK: 40,
                topP: 0.95,
            }
        })
    })

    if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || `API 錯誤: ${response.status}`)
    }

    const data = await response.json()

    // Extract image from response
    const candidates = data?.candidates || []
    for (const candidate of candidates) {
        const resParts = candidate?.content?.parts || []
        for (const part of resParts) {
            if (part.inline_data?.mime_type?.startsWith('image/')) {
                return {
                    imageData: part.inline_data.data,
                    mimeType: part.inline_data.mime_type
                }
            }
        }
    }

    throw new Error('Gemini 未回傳圖片，請調整 Prompt 或使用 Gemini 2.0 Flash Experimental 模型')
}

const ACC_LABELS = {
    'shelf': '層板',
    'drawer': '抽屜',
    'door-left': '左開門片',
    'door-right': '右開門片',
    'hanging-rod': '掛衣桿',
    'led': 'LED 燈條',
    'divider': '隔板',
}

export function buildPrompt({ cabinets, materials, vendorSpecs, environment }) {
    const specsText = Object.entries(vendorSpecs || {})
        .filter(([k]) => k !== 'notes')
        .map(([k, v]) => `${k}: ${v}`)
        .join('、') || '18mm 塑合板、標準五金'

    const notesText = vendorSpecs?.notes || ''

    const materialText = Object.entries(materials || {})
        .filter(([, v]) => v)
        .map(([zone, mat]) => {
            const label = { exterior: '外部面板', interior: '內部', door: '門片', drawer: '抽屜面板' }[zone] || zone
            return `${label}使用${mat}`
        })
        .join('、') || '白色系材質'

    const lightTemp = {
        '3000K': '暖白色 3000K',
        '4000K': '自然光 4000K',
        '6000K': '冷白色 6000K'
    }[environment?.lightTemp || '4000K'] || '自然光'

    const floorText = {
        'polished': '拋光磁磚地板',
        'wood-light': '淺色木地板',
        'wood-dark': '深色木地板'
    }[environment?.floor || 'wood-light'] || '淺色木地板'

    // Build cabinet structure description
    let cabinetDesc = ''
    if (cabinets && cabinets.length > 0) {
        const totalW = cabinets.reduce((s, c) => s + c.width, 0)
        cabinetDesc = `${cabinets.length} 個並排系統櫃，總寬 ${totalW}cm。\n`

        cabinets.forEach((cab, idx) => {
            const accessories = cab.accessories || []
            const accSummary = {}
            accessories.forEach(a => {
                const label = ACC_LABELS[a.type] || a.type
                accSummary[label] = (accSummary[label] || 0) + 1
            })
            const accText = Object.entries(accSummary)
                .map(([label, count]) => `${count} 個${label}`)
                .join('、') || '空櫃'

            cabinetDesc += `  櫃體 ${idx + 1}：寬 ${cab.width}cm × 高 ${cab.height}cm，內含 ${accText}\n`
        })
    } else {
        cabinetDesc = '系統櫃（詳見線稿圖）\n'
    }

    let prompt = `根據這張系統櫃正立面線稿圖，渲染成高品質的室內設計效果圖。

櫃體配置：
${cabinetDesc}
材質設定：${materialText}
廠商規格：${specsText}
環境設定：
- 天花板：白色平面天花板
- 燈光：每個櫃體上方一顆投射燈，色溫 ${lightTemp}
- 地板：${floorText}
視角：絕對正立面視角 (Front Orthographic View)
狀態：${environment?.doorState === 'open' ? '櫃門全部打開或隱藏，清楚顯示內部層板、抽屜與掛衣桿配置。' : '櫃門全部關閉，只顯示外部門片與抽屜面板外觀。'}
風格：現代簡約，室內設計效果圖，寫實光影

⛔ 嚴格限制與禁止項目 (CRITICAL RULES)：
1. 嚴格遵守原始線稿的尺寸外框與物理比例，絕對不可改變櫃體數量或寬高比例。
2. 絕對不可無中生有！禁止加入任何線稿中不存在的裝飾品、盆栽、花瓶、書籍、衣物、擺件等。
3. 嚴格保持畫面乾淨整潔，畫面中只允許存在櫃體本身、天花板、地板與背景牆面。`

    if (notesText) {
        prompt += `\n\n補充說明：${notesText}`
    }

    return prompt
}
