import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-gray-500">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
