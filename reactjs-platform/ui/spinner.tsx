// You can place this at the top of your file or import from your UI library
import { cn } from 'reactjs-platform/utilities';

export const Spinner = ({ className }: { className?: string }) => {
  return (
    <div className={cn('flex items-center justify-center h-full w-full py-10')}>
      <svg
        className={cn('animate-spin h-8 w-8 text-navy', className)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
};
