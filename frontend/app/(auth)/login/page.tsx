'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router     = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email)    e.email    = 'Email is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      setAuth(data.accessToken, data.user);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid credentials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Sign in</h1>
      <p className="mb-6 text-sm text-gray-500">Welcome back — sign in to your account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" error={errors.email} autoFocus />
        <Input label="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" error={errors.password} />
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">Create one</Link>
      </p>
    </div>
  );
}
