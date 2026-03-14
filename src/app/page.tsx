'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { validatePassword } from '@/lib/utils';
import { Shield, Mail, Lock, Eye, EyeOff, Terminal, Flag, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Login realizado com sucesso!');
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg grid-bg flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-cyber-cyan/10 via-cyber-purple/10 to-cyber-bg" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-cyber-cyan/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyber-purple/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyber-green/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Image
              src="/logo.png"
              alt="mdavelCTF Logo"
              width={160}
              height={160}
              className="drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]"
              priority
            />
          </div>
          <h1 className="text-5xl font-black mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-green">
              mdavelCTF
            </span>
          </h1>
          <p className="text-xl text-gray-400 mb-8">{t('auth.subtitle')}</p>

          <div className="grid grid-cols-3 gap-4 mt-12">
            <div className="cyber-card text-center">
              <Terminal className="w-8 h-8 text-cyber-cyan mx-auto mb-2" />
              <p className="text-xs text-gray-400">Desafios</p>
            </div>
            <div className="cyber-card text-center">
              <Flag className="w-8 h-8 text-cyber-green mx-auto mb-2" />
              <p className="text-xs text-gray-400">Bandeiras</p>
            </div>
            <div className="cyber-card text-center">
              <Zap className="w-8 h-8 text-cyber-purple mx-auto mb-2" />
              <p className="text-xs text-gray-400">Ranking</p>
            </div>
          </div>

          <div className="mt-12 font-mono text-sm text-gray-600">
            <p>$ ./capture --flag --compete</p>
            <p className="text-cyber-green">[+] Ready to hack...</p>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Image
                src="/logo.png"
                alt="mdavelCTF Logo"
                width={48}
                height={48}
                className="drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              />
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple">
                mdavelCTF
              </h1>
            </div>
            <p className="text-sm text-gray-500">{t('auth.subtitle')}</p>
          </div>

          <div className="cyber-card">
            <h2 className="text-2xl font-bold text-center mb-6">
              {t('auth.welcome')} <span className="text-cyber-cyan neon-text-cyan">mdavelCTF</span>
            </h2>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="cyber-label">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cyber-input pl-10"
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="cyber-label">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cyber-input pl-10 pr-10"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cyber-btn-primary w-full py-3 text-base"
              >
                {loading ? t('auth.logging_in') : t('auth.login')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              {t('auth.no_account')}{' '}
              <Link href="/register" className="text-cyber-cyan hover:text-cyber-cyan-light transition-colors font-medium">
                {t('auth.register_here')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
