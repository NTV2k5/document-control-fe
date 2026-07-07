'use client';

import type { VariantProps } from 'class-variance-authority';
import { toggleVariants } from 'reactjs-platform/ui/toggle';

import { cn } from 'reactjs-platform/utilities';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as React from 'react';

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: 'default',
  variant: 'default',
});

const ToggleGroup = ({
  ref,
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<React.ElementRef<typeof ToggleGroupPrimitive.Root> | null>;
  }) => {
  const contextValue = React.useMemo(() => ({ variant, size }), [variant, size]);

  return (
    <ToggleGroupPrimitive.Root ref={ref} className={cn('flex items-center justify-center gap-1', className)} {...props}>
      <ToggleGroupContext value={contextValue}>{children}</ToggleGroupContext>
    </ToggleGroupPrimitive.Root>
  );
};

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = ({
  ref,
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<React.ElementRef<typeof ToggleGroupPrimitive.Item> | null>;
  }) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}>
      {children}
    </ToggleGroupPrimitive.Item>
  );
};

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
