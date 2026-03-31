import * as React from 'react';
import { cn } from '../../lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <div>
      <select
        ref={ref}
        className={cn(
          'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm',
          'focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-400',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
