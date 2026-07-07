import { Link } from '@tanstack/react-router';
import { UserDropdown } from '../user-dropdown';

export const Header = () => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-white px-4 shadow-sm border-b border-gray-200">
      <div className="flex items-center">
        <Link to="/home">
          <img
            src="/gdu/logo/horizontal-long-logo-text.png"
            alt="Gia Dinh University"
            width={400}
            // height={50}
            className="rounded-full"
          />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserDropdown />
      </div>
    </header>
  );
};
