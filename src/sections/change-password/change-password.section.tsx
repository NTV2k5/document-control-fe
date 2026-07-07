import type { IChangePasswordFormValues, IChangePasswordSectionProps } from './change-password.type';
import { useAuth, useChangePassword } from 'reactjs-platform/utilities';
import { Link } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { LanguageSwitcher } from '../../components/i18n';
import { useTranslation } from '../../i18n';

export const ChangePasswordSection: React.FC<IChangePasswordSectionProps> = () => {
  const { t } = useTranslation();
  const { changePassword, loadingSelector } = useChangePassword();
  const { logout } = useAuth();

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<IChangePasswordFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',

    defaultValues: {},
  });

  const handleChangePassword = async (values: IChangePasswordFormValues) => {
    const { currentPassword, newPassword, confirmPassword } = values;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('auth.changePassword.requiredAll'));
      return;
    }

    const data = await changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (data === true) {
      toast.success(t('auth.changePassword.success'), {
        autoClose: 2500,
        pauseOnHover: true,
        closeOnClick: false,
      });
      await new Promise((res) => setTimeout(res, 100));
      await logout();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="flex w-full max-w-[400px] flex-1 flex-col items-center justify-center px-4 pt-12">
        <div className="mb-2 text-center">
          <Link to="/">
            <img
              src="/gdu/logo/vertical-logo-text.png"
              alt="Gia Dinh University"
              width={130}
              className="mx-auto mb-4 h-auto w-[130px]"
            />
          </Link>
        </div>

        <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-center font-serif text-3xl text-[#001B44]">{t('auth.changePassword.title')}</h2>
          <form onSubmit={handleSubmit(handleChangePassword)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="block text-[15px] font-medium text-[#001B44]">
                {t('auth.changePassword.oldPassword')}
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showOldPassword ? 'text' : 'password'}
                  {...register('currentPassword', {
                    required: t('auth.changePassword.oldPasswordRequired'),
                    minLength: { value: 6, message: t('auth.changePassword.passwordMinLength') },
                  })}
                  placeholder={t('auth.changePassword.passwordPlaceholder')}
                  className="h-12 w-full rounded-lg border border-gray-200 px-4 pr-12 text-[15px] text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showOldPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="block text-sm font-medium text-red-600" role="alert">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-[15px] font-medium text-[#001B44]">
                {t('auth.changePassword.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  {...register('newPassword', {
                    required: t('auth.changePassword.newPasswordRequired'),
                    minLength: { value: 6, message: t('auth.changePassword.passwordMinLength') },
                  })}
                  placeholder={t('auth.changePassword.passwordPlaceholder')}
                  className="h-12 w-full rounded-lg border border-gray-200 px-4 pr-12 text-[15px] text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="block text-sm font-medium text-red-600" role="alert">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-[15px] font-medium text-[#001B44]">
                {t('auth.changePassword.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword', {
                    required: t('auth.changePassword.confirmPasswordRequired'),
                    validate: (val, formValues) =>
                      val === formValues.newPassword || t('auth.changePassword.confirmMismatch'),
                  })}
                  placeholder={t('auth.changePassword.confirmPasswordPlaceholder')}
                  className="h-12 w-full rounded-lg border border-gray-200 px-4 pr-12 text-[15px] text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="block text-sm font-medium text-red-600" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex w-full justify-center">
              <button
                type="submit"
                disabled={loadingSelector}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#002B5B] px-12 py-3 text-white transition-colors hover:bg-[#002B5B]/90 disabled:opacity-60">
                {loadingSelector ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="text-sm">{t('auth.changePassword.submit')}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="py-6">
        <img src="/gdu/logo/logo-icon.png" alt="Gia Dinh University" width={80} className="h-auto" />
      </div>
    </div>
  );
};
