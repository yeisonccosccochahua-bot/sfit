import * as React from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className={cn('min-w-full divide-y divide-gray-200', className)} {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-gray-50', className)} {...props} />;
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-gray-100 bg-white', className)} {...props} />;
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-gray-50 transition-colors', className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-sm text-gray-800', className)} {...props} />;
}
