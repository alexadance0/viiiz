import { parseTemplate, type ChartTemplate } from './templates'

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('viiiz-templates', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Хранилище занято другой вкладкой. Закройте её и повторите.'))
  })
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('templates', mode), request = run(tx.objectStore('templates'))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? request.error) }
  })
}
export async function loadTemplates() { return (await transaction('readonly', (store) => store.getAll())).map(parseTemplate).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
export async function saveTemplate(template: ChartTemplate) { await transaction('readwrite', (store) => store.put(parseTemplate(template))) }
export async function deleteTemplate(id: string) { await transaction('readwrite', (store) => store.delete(id)) }
