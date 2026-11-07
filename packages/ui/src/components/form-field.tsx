import * as React from 'react';
import { cn } from '../lib/cn';

export const inputClasses =
  'block w-full min-h-12 rounded-md border-2 border-ink-600 bg-white px-3 py-2 text-base text-ink-900 placeholder:text-ink-600 aria-[invalid=true]:border-danger-700';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClasses, className)} {...props} />
));
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block font-semibold text-ink-900', className)} {...props} />;
}

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: React.ReactNode;
  errors?: string[] | undefined;
  children: (aria: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => React.ReactNode;
  className?: string;
}

/**
 * Label, hint and error message wired to the control with aria-describedby,
 * following the GOV.UK pattern of showing the error above the input.
 */
export function FormField({ id, label, hint, errors, children, className }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors && errors.length > 0 ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', errorId && 'border-l-4 border-danger-700 pl-3', className)}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-600">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="text-sm font-semibold text-danger-700">
          <span className="sr-only">Error: </span>
          {errors!.join('. ')}
        </p>
      ) : null}
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(errorId ? { 'aria-invalid': true as const } : {}),
      })}
    </div>
  );
}

export interface CheckboxFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  id: string;
  label: React.ReactNode;
  errors?: string[] | undefined;
}

export function CheckboxField({ id, label, errors, className, ...props }: CheckboxFieldProps) {
  const errorId = errors && errors.length > 0 ? `${id}-error` : undefined;
  return (
    <div className={cn('space-y-1', errorId && 'border-l-4 border-danger-700 pl-3', className)}>
      {errorId ? (
        <p id={errorId} className="text-sm font-semibold text-danger-700">
          <span className="sr-only">Error: </span>
          {errors!.join('. ')}
        </p>
      ) : null}
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-7 shrink-0 accent-teal-700"
          aria-describedby={errorId}
          aria-invalid={errorId ? true : undefined}
          {...props}
        />
        <label htmlFor={id} className="pt-0.5">
          {label}
        </label>
      </div>
    </div>
  );
}
