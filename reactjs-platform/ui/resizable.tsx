'use client';

import { cn } from 'reactjs-platform/utilities';
import { GripVertical } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';
import * as React from 'react';

const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group className={cn('h-full w-full', className)} {...props} />
);
ResizablePanelGroup.displayName = ResizablePrimitive.Group.displayName;

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      'relative flex shrink-0 items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full after:absolute aria-[orientation=vertical]:after:inset-y-0 aria-[orientation=vertical]:after:left-1/2 aria-[orientation=vertical]:after:w-1 aria-[orientation=vertical]:after:-translate-x-1/2 aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
      className,
    )}
    {...props}>
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="size-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);
ResizableHandle.displayName = ResizablePrimitive.Separator.displayName;

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
