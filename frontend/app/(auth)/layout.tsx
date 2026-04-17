import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600">
          <Zap size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">SitePilot</span>
      </div>
      {children}
    </div>
  );
}
