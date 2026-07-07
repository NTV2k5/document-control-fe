import { ListFilter } from 'lucide-react';

import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from 'reactjs-platform/ui/dropdown-menu';
import { Button } from 'reactjs-platform/ui';
import { cn } from 'reactjs-platform/utilities';

type DropdownMenuProps = React.ComponentProps<typeof DropdownMenu> & {
  activatedFilter?: boolean;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
};

export const FilterDropdown = ({ children, activatedFilter, contentClassName }: DropdownMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(activatedFilter ? 'bg-navy text-white hover:bg-navy/90' : 'text-navy')}>
          <ListFilter className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn('w-80', contentClassName, 'pr-4')}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
};
