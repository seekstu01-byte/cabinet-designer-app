import Dexie from 'dexie'

export const db = new Dexie('CabinetDesignerDB')

db.version(1).stores({
    textures: '++id, name, category, filename, dataUrl, createdAt',
    vendorSpecs: '++id, key, value, updatedAt',
    projects: '++id, name, data, createdAt, updatedAt'
})

// Helper functions
export const textureService = {
    async getAll() {
        return db.textures.orderBy('createdAt').reverse().toArray()
    },
    async add(texture) {
        return db.textures.add({ ...texture, createdAt: Date.now() })
    },
    async delete(id) {
        return db.textures.delete(id)
    }
}

export const vendorSpecsService = {
    async getAll() {
        const specs = await db.vendorSpecs.toArray()
        const result = {}
        specs.forEach(s => { result[s.key] = s.value })
        return result
    },
    async set(key, value) {
        const existing = await db.vendorSpecs.where('key').equals(key).first()
        if (existing) {
            return db.vendorSpecs.update(existing.id, { value, updatedAt: Date.now() })
        }
        return db.vendorSpecs.add({ key, value, updatedAt: Date.now() })
    },
    async setAll(specs) {
        const entries = Object.entries(specs)
        await Promise.all(entries.map(([key, value]) => vendorSpecsService.set(key, value)))
    }
}
