'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { validatePassword } from '@/lib/utils';
import { Shield, Mail, Lock, Eye, EyeOff, User, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.valid) {
      toast.error('Senha não atende aos requisitos mínimos');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (displayName.trim().length < 2) {
      toast.error('Nome de exibição deve ter pelo menos 2 caracteres');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email.trim(), password, displayName.trim());
    setLoading(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Cadastro realizado! Verifique seu e-mail para confirmar.');
      router.push('/');
    }
  };

  const requirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /[0-9]/.test(password) },
    { label: 'Caractere especial', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];

  return (
    <div className="min-h-screen bg-cyber-bg grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="w-10 h-10 text-cyber-cyan" />
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple">
              mdavelCTF
            </h1>
          </div>
          <p className="text-sm text-gray-500">{t('auth.subtitle')}</p>
        </div>

        <div className="cyber-card">
          <h2 className="text-2xl font-bold text-center mb-6">{t('auth.register')}</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="cyber-label">{t('auth.display_name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="cyber-input pl-10"
                  placeholder="Seu nome de exibição"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Requirements */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {req.met ? (
                        <CheckCircle className="w-3.5 h-3.5 text-cyber-green" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className={req.met ? 'text-cyber-green' : 'text-gray-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="cyber-label">{t('auth.confirm_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`cyber-input pl-10 ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-cyber-green/50'
                        : 'border-red-500/50'
                      : ''
                  }`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1">As senhas não coincidem</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !passwordValidation.valid || !passwordsMatch}
              className="cyber-btn-primary w-full py-3 text-base mt-2"
            >
              {loading ? t('auth.registering') : t('auth.register')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {t('auth.has_account')}{' '}
            <Link href="/" className="text-cyber-cyan hover:text-cyber-cyan-light transition-colors font-medium">
              {t('auth.login_here')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
