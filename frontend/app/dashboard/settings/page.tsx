'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth.store';

export default function SettingsPage() {
  const { user, setAuth, token } = useAuthStore();
  const [name, setName]         = useState(user?.name ?? '');
  const [email, setEmail]       = useState(user?.email ?? '');
  const [saving, setSaving]     = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [savingPw, setSavingPw]               = useState(false);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name, email });
      if (token && updated) setAuth(token, updated);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    setSavingPw(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Password change failed');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your account details</p>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold text-gray-900">Profile</h3></CardHeader>
        <CardBody>
          <form onSubmit={handleProfile} className="space-y-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold text-gray-900">Change Password</h3></CardHeader>
        <CardBody>
          <form onSubmit={handlePassword} className="space-y-4">
            <Input label="Current password" type="password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
            <Input label="New password" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
            <Button type="submit" loading={savingPw}>Change password</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
