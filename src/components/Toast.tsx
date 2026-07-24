import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'

export type ToastData = { id: string; tone: 'success' | 'error' | 'info'; message: string }

export function ToastRegion({ toasts, dismiss }: { toasts: ToastData[]; dismiss: (id: string) => void }) {
  return (
    <div className="toast-region" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info
        return <div className={`toast ${toast.tone}`} key={toast.id}><Icon size={17} /><span>{toast.message}</span><button onClick={() => dismiss(toast.id)} aria-label="Schließen"><X size={14} /></button></div>
      })}
    </div>
  )
}
