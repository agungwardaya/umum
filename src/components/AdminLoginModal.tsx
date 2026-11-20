import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, X } from 'lucide-react';

interface AdminLoginModalProps {
  open: boolean;
  isDefaultPassword?: boolean;
  onVerifyPassword: (password: string) => Promise<boolean>;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  open,
  isDefaultPassword = false,
  onVerifyPassword,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Masukkan password admin.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onVerifyPassword(password);
      if (ok) {
        onSuccess();
      } else {
        setError('Password admin salah. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="admin-login-title" className="text-base font-semibold text-slate-900">
                Masuk Mode Admin
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Akses penuh untuk melihat, menambah, mengedit, dan menghapus seluruh data anggota
                serta absensi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup login admin"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-password-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Password Admin
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password admin"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-3.5 pr-11 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isDefaultPassword && (
              <p className="mt-2 text-xs text-slate-500">
                Password awal: <span className="font-mono font-semibold text-slate-800">admin123</span>{' '}
                (segera ubah di menu Manajemen User setelah masuk).
              </p>
            )}
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              {submitting ? 'Memeriksa...' : 'Buka Akses Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
