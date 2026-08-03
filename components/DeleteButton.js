'use client'

import { useLocale } from '@/lib/i18n/LocaleProvider'

export function DeleteButton({ onDelete, label, confirmText }) {
  const { t } = useLocale()

  function handleClick() {
    if (window.confirm(confirmText ?? t('common.deleteConfirmDefault'))) onDelete()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs underline decoration-dotted underline-offset-4 shrink-0"
      style={{ color: 'var(--clay)' }}
    >
      {label ?? t('common.delete')}
    </button>
  )
}
