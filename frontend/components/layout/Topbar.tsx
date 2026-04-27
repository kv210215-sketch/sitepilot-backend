'use client';
import { usePathname } from 'next/navigation';

const titles: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/dashboard/projects': 'Projects',
  '/dashboard/billing':  'Billing',
  '/dashboard/settings': 'Settings',
};

function getTitle(pathname: string) {
  if (titles[pathname]) return titles[pathname];
  if (pathname.includes('/pages/')) return 'Page Editor';
  if (pathname.includes('/pages'))  return 'Pages';
  if (pathname.match(/\/projects\/[^/]+$/)) return 'Project';
  return 'SitePilot';
}

export function Topbar() {
  const pathname = usePathname();
  return (
    <header className="flex h-16 items-center border-b border-gray-200 bg-white px-6">
      <h1 className="text-base font-semibold text-gray-900">{getTitle(pathname)}</h1>
    </header>
  );
}
