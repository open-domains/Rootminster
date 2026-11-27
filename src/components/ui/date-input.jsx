import * as React from 'react';
import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * Native date input with a leading calendar icon. The browser's own picker
 * indicator is stretched invisibly across the field (see `.date-input` in
 * index.css), so clicking anywhere opens the picker while the visible icon
 * stays on the left. Placeholder segments render uppercase (MM/DD/YYYY).
 */
const DateInput = React.forwardRef(({ className, wrapperClassName, ...props }, ref) => (
  <div className={cn('relative', wrapperClassName)}>
    <CalendarDays
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      ref={ref}
      type="date"
      data-empty={props.value ? undefined : 'true'}
      className={cn('date-input relative pl-9 uppercase tabular-nums', className)}
      {...props}
    />
  </div>
));
DateInput.displayName = 'DateInput';

export { DateInput };
