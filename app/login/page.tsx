'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Command, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { setToken } from '@/lib/api-client';
import { toApiError } from '@/lib/api-client';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

const onSubmit = async (data: FormData) => {
  setLoading(true);

  // 🔧 TEMP DEV BYPASS — REMOVE BEFORE PRODUCTION
  // if (data.email === 'admin@gmail.com' && data.password === 'admin') {
  //   const mockToken = 'dev-bypass-token';
  //   const mockUser = {
  //     id: 'dev-admin',
  //     email: 'admin@gmail.com',
  //     full_name: 'Dev Admin',
  //     role: 'admin',
  //   } as any;

  //   setToken(mockToken);                              // localStorage (for api-client)
  //   document.cookie = `freightos_token=${mockToken}; path=/; SameSite=Lax`; // cookie (for middleware)
  //   setAuth(mockToken, mockUser);
  //   toast.success('Signed in (dev bypass)');
  //   router.push('/dashboard');
  //   setLoading(false);
  //   return;
  // }
  // 🔧 END TEMP DEV BYPASS

  try {
    const res = await authApi.login(data.email, data.password);
    setToken(res.access_token);
    document.cookie = `freightos_token=${res.access_token}; path=/; SameSite=Lax`;
    setAuth(res.access_token, res.user);
    toast.success(`Welcome back, ${res.user.full_name?.split(' ')[0] || ''}`);
    router.push('/dashboard');
  } catch (err) {
    const apiErr = toApiError(err as any);
    if (apiErr.fieldErrors) {
      for (const [field, msgs] of Object.entries(apiErr.fieldErrors)) {
        setError(field as keyof FormData, { message: msgs[0] });
      }
    } else if (apiErr.status === 401) {
      setError('password', { message: 'Invalid email or password' });
    } else {
      toast.error(apiErr.message);
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8e9f6] p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#746ad1] to-[#55b9cb] text-white shadow-[0_8px_20px_rgba(112,103,204,0.28)]">
            <Command size={24} />
          </span>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.04em] text-[#171725]">
            Freight<span className="text-[#7770d4]">OS</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[#858693]">Sign in to your operations workspace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-[20px] border border-white/80 bg-white p-6 shadow-[0_22px_60px_rgba(82,78,137,0.12)]">
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@freightops.in"
              className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none transition focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
            />
            {errors.email && <p className="mt-1 text-[11px] text-[#d45166]">{errors.email.message}</p>}
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Password</label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 pr-10 text-[13px] outline-none transition focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0ab] hover:text-[#777884]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-[11px] text-[#d45166]">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7068cf] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_14px_rgba(112,104,207,0.2)] transition hover:bg-[#6259c1] disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#a0a0ac]">
          Freight operations platform · Internal use only
        </p>
      </div>
    </main>
  );
}
