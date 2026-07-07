import type { IAdminUser } from 'reactjs-platform/utilities';
import type { AdminModalProps } from '../admin.type';
import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../../i18n';

interface IResetPasswordModalProps extends AdminModalProps {
  user: IAdminUser | null;
  onSubmit: (id: string, newPassword: string) => Promise<unknown>;
  loading: boolean;
  error: string | null;
}

export const ResetPasswordModal = ({ isOpen, onClose, user, onSubmit, loading, error }: IResetPasswordModalProps) => {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (newPassword.length < 6) {
      setLocalError(t('adminUsers.resetPassword.minLength'));
      return;
    }
    if (newPassword !== confirm) {
      setLocalError(t('adminUsers.resetPassword.mismatch'));
      return;
    }
    const ok = await onSubmit(user.id, newPassword);
    if (ok !== null) {
      setNewPassword('');
      setConfirm('');
      onClose();
    }
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-sm max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-[#001B44]">{t('adminUsers.resetPassword.title')}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <p className="text-sm text-gray-500">
              {t('adminUsers.resetPassword.description', { username: user.username })}
            </p>

            {displayError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{displayError}</div>}

            <div className="space-y-1.5">
              <label htmlFor="reset-password-new" className="block text-sm font-medium text-gray-700">
                {t('adminUsers.resetPassword.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="reset-password-new"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-gray-700">
                {t('adminUsers.resetPassword.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="reset-password-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {t('adminUsers.form.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-full bg-[#002B5B] px-5 py-2 text-sm text-white hover:bg-[#002B5B]/90 disabled:opacity-60">
                {loading && (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {t('adminUsers.resetPassword.submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
