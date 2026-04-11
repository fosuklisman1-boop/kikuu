'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GHANA_REGIONS } from '@/lib/utils'
import { User, MapPin, Plus, Trash2, Star, CheckCircle2 } from 'lucide-react'
import type { SavedAddress } from '@/lib/supabase/types'

interface Props {
  email: string
  initialName: string
  initialPhone: string
  initialAddresses: SavedAddress[]
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function ProfileForm({ email, initialName, initialPhone, initialAddresses }: Props) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses)
  const [addrLoading, setAddrLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAddr, setNewAddr] = useState<Omit<SavedAddress, 'id' | 'is_default'>>({
    recipient_name: initialName,
    phone: initialPhone,
    region: '',
    district: '',
    city: '',
    landmark: '',
    digital_address: '',
  })

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), phone: phone.trim() },
    })
    setProfileLoading(false)
    if (error) { setProfileError(error.message); return }
    setProfileSuccess(true)
    setTimeout(() => setProfileSuccess(false), 3000)
  }

  async function persistAddresses(updated: SavedAddress[]) {
    setAddrLoading(true)
    const supabase = createClient()
    await supabase.auth.updateUser({ data: { addresses: JSON.stringify(updated) } })
    setAddrLoading(false)
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault()
    const entry: SavedAddress = {
      ...newAddr,
      id: randomId(),
      is_default: addresses.length === 0,
    }
    const updated = [...addresses, entry]
    setAddresses(updated)
    await persistAddresses(updated)
    setShowAddForm(false)
    setNewAddr({ recipient_name: name, phone, region: '', district: '', city: '', landmark: '', digital_address: '' })
  }

  async function removeAddress(id: string) {
    const updated = addresses.filter((a) => a.id !== id)
    // If removed was default, make first one default
    if (updated.length > 0 && !updated.some((a) => a.is_default)) {
      updated[0].is_default = true
    }
    setAddresses(updated)
    await persistAddresses(updated)
  }

  async function setDefault(id: string) {
    const updated = addresses.map((a) => ({ ...a, is_default: a.id === id }))
    setAddresses(updated)
    await persistAddresses(updated)
  }

  return (
    <div className="space-y-6">
      {/* Profile details */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
            <User size={16} className="text-green-600" />
          </div>
          <h2 className="font-bold text-gray-900">Personal Details</h2>
        </div>
        <form onSubmit={saveProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Kwame Mensah"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              value={email}
              disabled
              className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="024 000 0000"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>

          {profileError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{profileError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={profileLoading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
            {profileSuccess && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 size={16} /> Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Saved addresses */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center">
              <MapPin size={16} className="text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-900">Saved Addresses</h2>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl transition-all"
          >
            <Plus size={13} /> Add new
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* Add form */}
          {showAddForm && (
            <form onSubmit={addAddress} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-dashed border-gray-200 mb-4">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">New Address</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { name: 'recipient_name', label: 'Full Name', placeholder: 'Kwame Mensah' },
                  { name: 'phone', label: 'Phone', placeholder: '024 000 0000' },
                  { name: 'district', label: 'District', placeholder: 'Accra Metropolitan' },
                  { name: 'city', label: 'City / Town', placeholder: 'Osu' },
                  { name: 'landmark', label: 'Landmark', placeholder: 'Near Shell Station' },
                  { name: 'digital_address', label: 'GhanaPostGPS (optional)', placeholder: 'GA-144-0000' },
                ].map(({ name, label, placeholder }) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      value={(newAddr as Record<string, string>)[name] ?? ''}
                      onChange={(e) => setNewAddr((a) => ({ ...a, [name]: e.target.value }))}
                      required={name !== 'digital_address'}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                  <select
                    value={newAddr.region}
                    onChange={(e) => setNewAddr((a) => ({ ...a, region: e.target.value }))}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
                  >
                    <option value="">Select Region</option>
                    {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button type="submit" disabled={addrLoading} className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
                  {addrLoading ? 'Saving...' : 'Save Address'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {addresses.length > 0 ? (
            addresses.map((addr) => (
              <div key={addr.id} className={`rounded-xl border p-4 relative ${addr.is_default ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                {addr.is_default && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    <Star size={9} className="fill-green-600" /> Default
                  </span>
                )}
                <p className="font-semibold text-gray-900 text-sm">{addr.recipient_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{addr.phone}</p>
                <p className="text-xs text-gray-500">
                  {addr.city}, {addr.district}, {addr.region}
                </p>
                {addr.landmark && <p className="text-xs text-gray-400">Near: {addr.landmark}</p>}

                <div className="flex items-center gap-3 mt-3">
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      disabled={addrLoading}
                      className="text-xs text-green-600 font-semibold hover:underline disabled:opacity-50"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    onClick={() => removeAddress(addr.id)}
                    disabled={addrLoading}
                    className="ml-auto text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">
              No saved addresses yet. Add one to speed up checkout.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
