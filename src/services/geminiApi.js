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
        const parts = candidate?.content?.parts || []
        for (const part of parts) {
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

export function buildPrompt({ cabinets, materials, vendorSpecs, environment }) {
    const specsText = Object.entries(vendorSpecs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('、') || '18mm 塑合板、標準五金'

    const materialText = Object.entries(materials || {})
        .filter(([, v]) => v)
        .map(([zone, mat]) => `${zone}使用${mat}`)
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

    return `根據這張系統櫃線稿圖，渲染成高品質的室內效果圖。

材質設定：${materialText}
廠商規格：${specsText}
環境設定：
- 天花板：白色平面天花板
- 燈光：每個櫃體上方一顆投射燈，色溫 ${lightTemp}
- 地板：${floorText}
視角：正面視角
風格：現代簡約，寫實室內設計，高品質渲染，室內設計效果圖，8K 清晰`
}
