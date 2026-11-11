import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/PasswordField';
import { TextField } from '@/components/ui/TextField';
import { useLoginMutation, useSessionQuery } from '../api/authApi';
import { AuthShell } from '../components/AuthShell';
import { homePathFor } from '../components/RequireAuth';
import { loginFormSchema, type LoginFormInput, type LoginRequest } from '../schemas/auth';

interface LocationState {
  readonly from?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionQuery = useSessionQuery();
  const loginMutation = useLoginMutation();
  const [isForgotHelpOpen, setIsForgotHelpOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginRequest>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  if (sessionQuery.data) return <Navigate to={homePathFor(sessionQuery.data.role)} replace />;

  const handleLogin = (request: LoginRequest) => {
    loginMutation.mutate(request, {
      onSuccess: ({ user }) => navigate((location.state as LocationState | null)?.from ?? homePathFor(user.role), { replace: true }),
    });
  };

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to BAS Finance">
      <form noValidate onSubmit={handleSubmit(handleLogin)} className="flex flex-col gap-5">
        <TextField label="Email address" type="email" autoComplete="username" isRequired errorMessage={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          isRequired
          errorMessage={errors.password?.message}
          labelAction={
            <button
              type="button"
              aria-expanded={isForgotHelpOpen}
              onClick={() => setIsForgotHelpOpen((current) => !current)}
              className="text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand"
            >
              Forgot password?
            </button>
          }
          {...register('password')}
        />
        {isForgotHelpOpen ? (
          <Alert tone="info">Password reset isn’t self-service yet. Ask your BAS Finance administrator to send you a new invitation link.</Alert>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 rounded border-line accent-brand" {...register('rememberMe')} />
          Remember me
        </label>
        {loginMutation.error ? <Alert tone="danger">{loginMutation.error.message}</Alert> : null}
        <Button type="submit" isLoading={loginMutation.isPending} className="w-full py-2.5">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
