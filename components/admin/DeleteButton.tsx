'use client'

interface Props {
  action: () => Promise<void>
  confirmMessage?: string
}

export default function DeleteButton({ action, confirmMessage = 'Are you sure?' }: Props) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="text-xs text-red-500 hover:underline"
        onClick={(e) => { if (!confirm(confirmMessage)) e.preventDefault() }}
      >
        Delete
      </button>
    </form>
  )
}
