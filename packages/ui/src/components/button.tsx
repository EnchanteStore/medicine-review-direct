import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900',
        secondary:
          'border-2 border-teal-700 bg-white text-teal-800 hover:bg-teal-50 active:bg-teal-100',
        ghost: 'text-teal-800 underline-offset-4 hover:bg-teal-50 hover:underline',
        danger: 'bg-danger-700 text-white hover:brightness-95',
      },
      size: {
        md: '',
        lg: 'min-h-14 px-7 text-lg',
        sm: 'min-h-11 px-4 text-sm',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
