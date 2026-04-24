import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface NavbarProps { title: string }

export const Navbar = ({ title }: NavbarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700">
          <User className="h-5 w-5 text-gray-400" />
          <span className="font-medium">{user?.fullName}</span>
        </div>
        <button onClick={handleLogout} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
