import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export type StatusType = 'pending' | 'approved' | 'rejected' | 'confirmed' | 'cancelled';

const statusConfig = {
  pending: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  approved: {
    label: 'Aprovado',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  rejected: {
    label: 'Rejeitado',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-gray-100 text-gray-800 border-gray-300',
  },
};

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusType;
  customLabel?: string;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, customLabel, className, ...props }, ref) => {
    const config = statusConfig[status];
    const label = customLabel || config.label;

    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border',
          config.className,
          className
        )}
        ref={ref}
        {...props}
      >
        {label}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';
