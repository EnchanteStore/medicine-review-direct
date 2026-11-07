import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/cn';

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-5xl px-5 sm:px-8', className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-sand-200 bg-white p-6 shadow-card sm:p-8', className)}
      {...props}
    />
  );
}

export const alertVariants = cva('rounded-md border-l-[6px] p-4 sm:p-5', {
  variants: {
    tone: {
      info: 'border-teal-700 bg-teal-50 text-ink-900',
      success: 'border-success-700 bg-success-50 text-ink-900',
      warning: 'border-warning-800 bg-warning-50 text-ink-900',
      danger: 'border-danger-700 bg-danger-50 text-ink-900',
    },
  },
  defaultVariants: { tone: 'info' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ tone, title, className, children, role, ...props }: AlertProps) {
  const defaultRole = tone === 'danger' ? 'alert' : 'status';
  return (
    <div role={role ?? defaultRole} className={cn(alertVariants({ tone }), className)} {...props}>
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-sand-100 text-ink-700',
        teal: 'bg-teal-100 text-teal-900',
        warning: 'bg-warning-50 text-warning-800 ring-1 ring-warning-800/30',
        draft: 'bg-warning-50 text-warning-800 ring-1 ring-warning-800/40 uppercase tracking-wide',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function SkipLink({ href = '#main-content' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-ink-900"
    >
      Skip to main content
    </a>
  );
}
