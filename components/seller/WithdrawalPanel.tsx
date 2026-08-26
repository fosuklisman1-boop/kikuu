'use client'

import { useState, useTransition } from 'react'
import { formatGHS } from '@/lib/utils'
import { updateShopPayoutDetails } from '@/lib/actions/wallet'
import { requestWithdrawal } from '@/lib/actions/withdrawals'
import type { WithdrawalRequest } from '@/lib/supabase/types'

interface Props {
  momoNumber: string | null
  momoName: string | null
  withdrawableBalance: number
  minAmount: number
  pendingRequest: WithdrawalRequest | null
}

export default function WithdrawalPanel({ momoNumber, momoName, withdrawableBalance, minAmount, pendingRequest }: Props) {
  const [editingPayout, setEditingPayout] = useState(!momoNumber || !momoName)
  const [payoutError, setPayoutError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSavePayout(formData: FormData) {
    setPayoutError('')
    startTransition(async () => {
      const result = await updateShopPayoutDetails(formData)
      if (result?.error) {
        setPayoutError(result.error)
        return
      }
      setEditingPayout(false)
    })
  }

  function handleRequest(formData: FormData) {
    setRequestError('')
    setRequestSuccess(false)
    startTransition(async () => {
      const result = await requestWithdrawal(formData)
      if (result?.error) {
        setRequestError(result.error)
        return
      }
      setRequestSuccess(true)
    })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 max-w-sm space-y-5">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Available to withdraw</p>
        <p className="text-3xl font-bold text-gray-900">{formatGHS(withdrawableBalance)}</p>
        <p className="text-xs text-gray-400 mt-1">Minimum withdrawal: {formatGHS(minAmount)}</p>
      </div>

      {editingPayout ? (
        <form action={handleSavePayout} className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">MoMo number</label>
          <input name="momo_number" defaultValue={momoNumber ?? ''} placeholder="0241234567" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <label className="block text-xs font-medium text-gray-600">Name on MoMo account</label>
          <input name="momo_name" defaultValue={momoName ?? ''} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          {payoutError && <p className="text-xs text-red-600">{payoutError}</p>}
          <button type="submit" disabled={pending} className="text-sm font-semibold text-green-600 disabled:text-gray-300">
            Save payout details
          </button>
        </form>
      ) : (
        <div className="text-sm text-gray-600">
          <p>{momoName} — {momoNumber}</p>
          <button onClick={() => setEditingPayout(true)} className="text-xs text-green-600 hover:underline mt-1">
            Edit
          </button>
        </div>
      )}

      {!editingPayout && (
        pendingRequest ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            Withdrawal of {formatGHS(pendingRequest.amount)} pending since{' '}
            {new Date(pendingRequest.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
          </p>
        ) : (
          <form action={handleRequest} className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Amount to withdraw</label>
            <input name="amount" type="number" min={minAmount} step="0.01" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            {requestError && <p className="text-xs text-red-600">{requestError}</p>}
            {requestSuccess && <p className="text-xs text-green-600">Withdrawal requested.</p>}
            <button
              type="submit"
              disabled={pending || withdrawableBalance < minAmount}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Request Withdrawal
            </button>
          </form>
        )
      )}
    </div>
  )
}
