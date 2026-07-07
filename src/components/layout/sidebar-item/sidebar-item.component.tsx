import { Link } from '@tanstack/react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui';
import { cn } from '../../../lib';
import type { ISidebarItemProps } from '../layout.type';

export const SidebarItem = ({ icon, label, href, is_active, isCollapsed }: ISidebarItemProps) => {
  const linkContent = (
    <Link
      to={href as any}
      className={cn(
        'group flex items-center px-1 py-1.5 text-base transition-colors duration-200',
        isCollapsed ? 'justify-center' : 'justify-start',
      )}>
      <div
        className={cn(
          'flex items-center rounded-2xl border transition-all duration-200',
          isCollapsed ? 'size-12 justify-center rounded-xl' : 'w-full min-w-0 gap-4 px-4 py-3',
          is_active
            ? 'border-[#0B2559] bg-[#0B2559] text-white shadow-[0_10px_20px_rgba(11,37,89,0.18)]'
            : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
        )}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
            isCollapsed ? 'size-10' : 'size-10',
            is_active
              ? isCollapsed
                ? 'bg-transparent text-white'
                : 'bg-white/14 text-white'
              : 'bg-slate-100 text-slate-600 group-hover:bg-white',
          )}>
          {icon}
        </div>
        {!isCollapsed ? <span className="min-w-0 flex-1 truncate whitespace-nowrap font-semibold">{label}</span> : null}
      </div>
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
