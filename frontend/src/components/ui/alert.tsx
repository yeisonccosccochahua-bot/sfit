import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}

const styles = {
  info:    { wrap: 'bg-blue-50 border-blue-300 text-blue-800',  Icon: Info },
  success: { wrap: 'bg-green-50 border-green-300 text-green-800', Icon: CheckCircle2 },
  warning: { wrap: 'bg-amber-50 border-amber-300 text-amber-800', Icon: AlertCircle },
  error:   { wrap: 'bg-red-50 border-red-300 text-red-800',    Icon: XCircle },
};

export function Alert({ variant = 'info', title, children, className, ...props }: AlertProps) {
  const { wrap, Icon } = styles[variant];
  return (
    <div className={cn('flex gap-3 rounded-md border p-4', wrap, className)} role="alert" {...props}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        {title && <p className="font-semibold mb-1">{title}</p>}
        {children}
      </div>
    </div>
  );
}
