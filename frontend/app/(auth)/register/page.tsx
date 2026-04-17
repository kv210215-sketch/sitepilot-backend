'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<{ name?: string; email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name)                   e.name     = 'Name is required';
    if (!email)                  e.email    = 'Email is required';
    if (password.length < 8)     e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await authApi.register({ name, email, password });
      setAuth(data.accessToken, data.user);
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Registration failed';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Create account</h1>
      <p className="mb-6 text-sm text-gray-500">Start your SitePilot journey today</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name" error={errors.name} autoFocus />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" error={errors.email} />
        <Input label="Password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" error={errors.password} />
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
