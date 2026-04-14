'use client'

import { createClient } from '@/lib/supabase/client'
import { isValidGhanaPhone } from '@/lib/utils'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, User, Phone, ShoppingBag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const inputCls = 'w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/10 transition-all'
const inputClsPr10 = 'w-full border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/10 transition-all'

function AuthForm() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup fields
  const [fullName, setFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/account'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoading(false)
    if (err) {
      setError('Incorrect email or password. Please try again.')
      return
    }
    const { data: { user: loggedInUser } } = await supabase.auth.getUser()
    const { data: profile } = loggedInUser
      ? await supabase.from('users').select('role').eq('id', loggedInUser.id).single()
      : { data: null }
    router.push(profile?.role === 'admin' ? '/admin' : redirectTo)
    router.refresh()
  }

  async function handleForgotPassword() {
    if (!loginEmail.trim()) {
      setError('Enter your email address above, then click "Forgot password?".')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Password reset link sent. Check your email.')
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPhoneError('')

    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).')
      return
    }
    if (phone.trim() && !isValidGhanaPhone(phone)) {
      setPhoneError('Enter a valid Ghana phone number (e.g. 024 123 4567).')
      return
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      },
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setSuccess('Account created! Check your email to confirm, then sign in.')
    setTab('login')
    setLoginEmail(signupEmail)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-[#b45309] font-extrabold text-xl">
          <div className="w-7 h-7 bg-[#b45309] rounded-lg flex items-center justify-center text-white font-black text-sm">K</div>
          kikuu
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500 text-sm">{tab === 'login' ? 'Sign In' : 'Create Account'}</span>
        <Link href="/" className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-[#b45309] transition-colors">
          <ArrowLeft size={13} /> Continue shopping
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center pt-10 pb-16 px-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b">
              {(['login', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); setSuccess(''); setPhoneError('') }}
                  className={`flex-1 py-4 text-sm font-semibold transition-all ${
                    tab === t
                      ? 'text-[#b45309] border-b-2 border-[#b45309] bg-[#fdf6ec]/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              {/* Success banner */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 bg-[#fdf6ec] border border-[#b45309]/30 text-[#92400e] text-sm px-4 py-3 rounded-xl"
                  >
                    ✓ {success}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {tab === 'login' ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          autoFocus
                          placeholder="you@example.com"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={loading}
                          className="text-xs text-[#b45309] hover:underline disabled:opacity-50"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className={inputClsPr10}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm mt-2"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <p className="text-center text-xs text-gray-500 pt-1">
                      Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => setTab('signup')} className="text-[#b45309] font-semibold hover:underline">
                        Create one free
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSignup}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          minLength={2}
                          autoFocus
                          placeholder="Kwame Mensah"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          required
                          placeholder="you@example.com"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                          placeholder="024 000 0000"
                          className={`${inputCls} ${phoneError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                      </div>
                      {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Min 8 chars"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="Repeat"
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                        {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showPassword ? 'Hide' : 'Show'} password
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm mt-1"
                    >
                      {loading ? 'Creating account...' : 'Create Account'}
                    </button>

                    <p className="text-xs text-gray-400 text-center leading-relaxed">
                      By creating an account you agree to our{' '}
                      <Link href="/terms" className="text-[#b45309] hover:underline">Terms</Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-[#b45309] hover:underline">Privacy Policy</Link>.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Guest CTA */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-3">Don&apos;t want to create an account?</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#b45309] bg-white border border-[#e8c98a] hover:border-[#b45309] px-5 py-2.5 rounded-xl transition-all hover:shadow-sm"
            >
              <ShoppingBag size={15} />
              Continue as Guest
            </Link>
          </div>

          {/* Benefits */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '📦', label: 'Track all your orders' },
              { icon: '❤️', label: 'Save your wishlist' },
              { icon: '⚡', label: 'Faster checkout' },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="text-xl mb-1">{icon}</div>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountLoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  )
}
