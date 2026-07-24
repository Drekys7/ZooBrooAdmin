import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Löschen', danger = true, onConfirm, onClose }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Schließen"><X size={17} /></button>
        <div className="dialog-icon danger"><AlertTriangle size={21} /></div>
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="button ghost" onClick={onClose}>Abbrechen</button>
          <button className={`button ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
