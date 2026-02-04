import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Truck,
  Package,
  MapPin,
  Wallet,
  AlertTriangle,
  Settings,
  LogOut,
  Key,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients API', href: '/clients', icon: Key },
  { name: 'Entreprises', href: '/companies', icon: Building2 },
  { name: 'Livreurs', href: '/drivers', icon: Users },
  { name: 'Livraisons', href: '/deliveries', icon: Package },
  { name: 'Zones', href: '/zones', icon: MapPin },
  { name: 'Finances', href: '/finances', icon: Wallet },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { signOut, adminUser } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800">
        <Truck className="w-8 h-8 text-primary-500" />
        <div className="ml-3">
          <span className="text-lg font-bold">LogiTrack</span>
          <span className="text-xs text-gray-400 block">Africa Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center mb-3">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-white font-semibold">
              {adminUser?.full_name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
              {adminUser?.full_name || 'Admin'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {adminUser?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
