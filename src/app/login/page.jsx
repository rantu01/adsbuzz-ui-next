'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Mail, Lock, ArrowRight, Shield, Zap, BarChart3, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebaseClient';

const BRAND_COLORS = {
  primary: '#F68B2D',
  navy: '#131926',
  blue: '#154A7D',
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || 'Login failed. Please try again.');
      }

      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const features = [
    { icon: BarChart3, text: 'Real-time balances & ad spend insights' },
    { icon: Shield, text: 'Secure account management' },
    { icon: Zap, text: 'Fast top-ups & transaction tracking' },
    { icon: Zap, text: 'Unified customer & reseller CRM' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Hero / brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.navy}, ${BRAND_COLORS.blue})` }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl"
            style={{ backgroundColor: BRAND_COLORS.primary }}
          />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="flex items-center gap-3 mb-10">
            <img src="/images/logo_white.svg" alt="AdsBuzz" className="h-14 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Manage Your Ad Accounts
            <span style={{ color: BRAND_COLORS.primary }}> Smarter</span>
          </h2>

          <p className="text-lg text-white/80 mb-12 max-w-md leading-relaxed">
            Operations console for ad account loading, reseller CRM, and billing card
            reconciliation — all in one powerful dashboard.
          </p>

          <div className="space-y-5">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                  <Icon size={20} style={{ color: BRAND_COLORS.primary }} />
                </div>
                <span className="text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-950 px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img src="/images/logo_white.svg" alt="AdsBuzz" className="h-12 w-auto mx-auto mb-3 rounded-lg object-contain" referrerPolicy="no-referrer" />
          </div>

          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 sm:p-10">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
              <p className="text-sm text-slate-400 mt-1">Sign in to access your dashboard</p>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl mb-5 border border-red-500/20 flex items-start gap-2">
                <span className="mt-0.5 shrink-0">&#9888;</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2 group"
                style={{ backgroundColor: BRAND_COLORS.primary }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">
            &copy; {new Date().getFullYear()} AdsBuzz Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

function getAuthErrorMessage(err) {
  const code = err?.code;
  if (code === 'auth/user-not-found') return 'No account found with this email.';
  if (code === 'auth/wrong-password') return 'Incorrect password.';
  if (code === 'auth/invalid-credential') return 'Invalid email or password.';
  if (code === 'auth/invalid-email') return 'Invalid email format.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
  return err?.message || 'Authentication failed. Please try again.';
}