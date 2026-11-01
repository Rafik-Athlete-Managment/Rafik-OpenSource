import Swal from 'sweetalert2'
import { locale } from './i18n'

const toast = Swal.mixin({
  toast: true,
  showConfirmButton: false,
  showCloseButton: true,
  timer: 5000,
  timerProgressBar: true,
  customClass: { popup: 'rafik-toast' },
})
const notifiedErrors = new WeakSet<object>()

/** Shows a short success toast for a completed user action. */
export function notifySuccess(message: string) {
  const rtl = locale.value === 'ar'
  void toast.fire({
    icon: 'success',
    title: message,
    position: rtl ? 'top-start' : 'top-end',
    customClass: { popup: rtl ? 'rafik-toast rafik-toast--rtl' : 'rafik-toast' },
  })
}

/** Shows an error toast while leaving the failed form available for correction. */
export function notifyError(message: string) {
  const rtl = locale.value === 'ar'
  void toast.fire({
    icon: 'error',
    title: message,
    position: rtl ? 'top-start' : 'top-end',
    customClass: { popup: rtl ? 'rafik-toast rafik-toast--rtl' : 'rafik-toast' },
  })
}

/** Shows one error toast for a repeated failure instead of repeating it on every retry. */
export function notifyErrorOnce(error: unknown, message: string) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    if (notifiedErrors.has(error)) return
    notifiedErrors.add(error)
  }
  notifyError(message)
}
