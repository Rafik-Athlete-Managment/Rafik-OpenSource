import { ref } from 'vue'
export const updatesSupported = import.meta.env.PROD && 'serviceWorker' in navigator
export const updateState = ref<'idle' | 'checking' | 'current' | 'ready' | 'failed'>('idle')
let registration: Promise<ServiceWorkerRegistration> | undefined
function observe(reg: ServiceWorkerRegistration) {
  if (reg.waiting) updateState.value = 'ready'
  const worker = reg.installing
  if (!worker) return
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') updateState.value = reg.waiting ? 'ready' : 'current'
    if (worker.state === 'activated' && !reg.waiting) updateState.value = 'current'
    if (worker.state === 'redundant' && !reg.waiting) {
      updateState.value = 'failed'
      // A failed first install unregisters itself. Retry with a fresh registration.
      if (!reg.active) registration = undefined
    }
  })
}
/** Registers the service worker that checks for and installs web app updates. */
export function registerAppUpdates() {
  if (!updatesSupported || registration) return
  // Register immediately; failed installation must not imply offline availability.
  registration = navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
  void registration
    .then((reg) => {
      observe(reg)
      reg.addEventListener('updatefound', () => observe(reg))
    })
    .catch(() => {
      registration = undefined
      updateState.value = 'failed'
    })
}
/** Checks whether a newer web app build is ready and updates the visible status. */
export async function checkAppUpdate() {
  if (!updatesSupported || updateState.value === 'checking') return
  updateState.value = 'checking'
  try {
    registerAppUpdates()
    const reg = await registration!
    await reg.update()
    observe(reg)
    if (!reg.installing)
      updateState.value = reg.waiting ? 'ready' : reg.active ? 'current' : 'failed'
  } catch {
    registration = undefined
    updateState.value = 'failed'
  }
}
