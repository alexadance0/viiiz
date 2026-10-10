import { validateProject, type EditorProject } from './project'

let connection: Promise<IDBDatabase> | undefined
let opened: IDBDatabase | undefined
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('viiiz-projects', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('projects')
    request.onsuccess = () => {
      opened = request.result
      request.result.onversionchange = () => { request.result.close(); connection = undefined; opened = undefined }
      resolve(request.result)
    }
    request.onerror = () => { connection = undefined; reject(request.error) }
    request.onblocked = () => { connection = undefined; reject(new Error('Хранилище занято другой вкладкой')) }
  })
  return connection
}
function transaction<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', mode)
    const request = run(tx.objectStore('projects'))
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = tx.onerror = () => reject(tx.error ?? request.error)
    if (mode === 'readwrite') tx.commit?.()
  })
}
export async function loadDraft(): Promise<EditorProject | null> {
  const draft = await transaction(await database(), 'readonly', (store) => store.get('draft'))
  return draft ? validateProject(draft) : null
}
export function saveDraft(project: EditorProject) {
  // Start the write before pagehide returns; a promise queue can lose the last edit on navigation.
  const write = (db: IDBDatabase) => transaction(db, 'readwrite', (store) => store.put(project, 'draft'))
  return opened ? write(opened) : database().then(write)
}
