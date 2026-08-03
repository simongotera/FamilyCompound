'use client'

export function DeleteButton({ onDelete, label = 'Delete', confirmText = "Delete this? This can't be undone." }) {
  function handleClick() {
    if (window.confirm(confirmText)) onDelete()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs underline decoration-dotted underline-offset-4 shrink-0"
      style={{ color: 'var(--clay)' }}
    >
      {label}
    </button>
  )
}
