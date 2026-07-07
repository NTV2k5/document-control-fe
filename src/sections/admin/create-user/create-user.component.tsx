import React, { useId } from 'react';
import type { IAdminCreateUserPayload } from 'reactjs-platform/utilities';
import type { AdminModalProps } from '../admin.type';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { useTranslation } from '../../../i18n';

interface ICreateUserModalProps extends AdminModalProps {
  onSubmit: (payload: IAdminCreateUserPayload) => Promise<unknown>;
  loading: boolean;
  error: string | null;
}

interface FormValues {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export const CreateUserModal = ({ isOpen, onClose, onSubmit, loading, error }: ICreateUserModalProps) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  if (!isOpen) return null;

  const submit = async (values: FormValues) => {
    const ok = await onSubmit(values as IAdminCreateUserPayload);
    if (ok) {
      reset();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-md max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#001B44]">{t('adminUsers.form.createTitle')}</h2>
              <p className="mt-0.5 text-xs text-gray-400">{t('adminUsers.form.createDescription')}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(submit)} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('adminUsers.form.first_name')}>
                <input
                  {...register('first_name')}
                  placeholder={t('adminUsers.form.firstNamePlaceholder')}
                  className={inputCls()}
                />
              </Field>
              <Field label={t('adminUsers.form.last_name')}>
                <input
                  {...register('last_name')}
                  placeholder={t('adminUsers.form.lastNamePlaceholder')}
                  className={inputCls()}
                />
              </Field>
            </div>

            <Field label={t('adminUsers.form.username')} error={errors.username?.message}>
              <input
                {...register('username', { required: t('adminUsers.form.required') })}
                placeholder="nguyenvanan"
                className={inputCls(!!errors.username)}
              />
            </Field>

            <Field label={t('adminUsers.form.email')} error={errors.email?.message}>
              <input
                {...register('email', {
                  required: t('adminUsers.form.required'),
                  pattern: { value: /^\S+@\S+\.\S+$/, message: t('adminUsers.form.invalidEmail') },
                })}
                type="email"
                placeholder="nguyenvanan@example.com"
                className={inputCls(!!errors.email)}
              />
            </Field>

            <Field label={t('adminUsers.form.password')} error={errors.password?.message}>
              <input
                {...register('password', {
                  required: t('adminUsers.form.required'),
                  minLength: { value: 6, message: t('adminUsers.form.minPassword') },
                })}
                type="password"
                placeholder="••••••••"
                className={inputCls(!!errors.password)}
              />
            </Field>

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
                {t('adminUsers.form.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const fieldId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {typeof children === 'object' && children !== null && 'props' in children
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: fieldId })
        : children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError = false) {
  return `h-10 w-full rounded-lg border px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44] ${hasError ? 'border-red-400' : 'border-gray-200'}`;
}
