import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-500 focus:ring-red-400' : 'border-gray-300',
          className,
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export { Input };
