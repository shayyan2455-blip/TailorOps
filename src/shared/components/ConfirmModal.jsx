export default function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="c-backdrop" onClick={onCancel}>
      <div className="c-form-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: '8px 0 20px', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="c-action-btn" onClick={onCancel}>Cancel</button>
          <button className="c-add-btn" onClick={onConfirm} style={{ padding: '6px 20px' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
