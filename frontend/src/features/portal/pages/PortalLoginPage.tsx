import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { TextField } from '@/components/ui/TextField';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { usePortalLoginMutation, usePortalSessionQuery } from '../api/portalApi';
import { portalLoginFormSchema, type PortalLoginFormInput, type PortalLoginRequest } from '../schemas/portal';

/** Customer sign-in (/portal/login). Staff sign in at /login. */
export default function PortalLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionQuery = usePortalSessionQuery();
  const loginMutation = usePortalLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PortalLoginFormInput, unknown, PortalLoginRequest>({ resolver: zodResolver(portalLoginFormSchema), defaultValues: { email: '', password: '', rememberMe: false } });

  if (sessionQuery.data) return <Navigate to="/portal" replace />;

  const from = (location.state as { from?: string } | null)?.from;
  const handleLogin = (request: PortalLoginRequest) =>
    loginMutation.mutate(request, { onSuccess: () => navigate(from?.startsWith('/portal') ? from : '/portal', { replace: true }) });

  return (
    <AuthShell title="Sign in to your account" subtitle="See your loans, apply, and send us your documents">
      <form noValidate onSubmit={handleSubmit(handleLogin)} className="flex flex-col gap-5">
        <TextField label="Email address" type="email" autoComplete="username" isRequired errorMessage={errors.email?.message} {...register('email')} />
        <PasswordField label="Password" autoComplete="current-password" isRequired errorMessage={errors.password?.message} {...register('password')} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 rounded border-line accent-brand" {...register('rememberMe')} />
          Keep me signed in on this device
        </label>
        {loginMutation.error ? <Alert tone="danger">{loginMutation.error.message}</Alert> : null}
        <Button type="submit" isLoading={loginMutation.isPending} className="w-full py-2.5">
          Sign in
        </Button>
        <p className="text-center text-sm text-ink-muted">
          No account yet? Your BAS Finance loan officer sends you a link to set one up. Work at BAS Finance?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Staff sign-in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
