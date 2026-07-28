import { Link } from '@tanstack/react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui';
import { cn } from '../../../lib';
import type { ISidebarItemProps } from '../layout.type';

export const SidebarItem = ({ icon, label, href, is_active, isCollapsed, disabled }: ISidebarItemProps) => {
  const itemInner = (
    <div
      className={cn(
        'flex items-center transition-all duration-200',
        isCollapsed ? 'size-12 justify-center rounded-xl' : 'w-full min-w-0 gap-3 px-3 py-2.5 rounded-full',
        is_active
          ? 'bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.25)]'
          : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent text-slate-400',
      )}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center transition-colors duration-200',
          isCollapsed ? 'size-9 rounded-full' : 'size-5',
          is_active
            ? 'text-white'
            : 'text-slate-500 group-hover:text-slate-800',
          disabled && 'text-slate-300 group-hover:text-slate-300',
        )}>
        {icon}
      </div>
      {!isCollapsed ? <span className="min-w-0 flex-1 truncate whitespace-nowrap font-bold text-[12.5px]">{label}</span> : null}
    </div>
  );

  const linkContent = disabled ? (
    <div
      className={cn(
        'group flex items-center px-2 py-1 text-base cursor-not-allowed',
        isCollapsed ? 'justify-center' : 'justify-start',
      )}>
      {itemInner}
    </div>
  ) : (
    <Link
      to={href as any}
      className={cn(
        'group flex items-center px-2 py-1 text-base transition-colors duration-200',
        isCollapsed ? 'justify-center' : 'justify-start',
      )}>
      {itemInner}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
};
