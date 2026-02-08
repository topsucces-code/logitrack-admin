import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="ml-64">
        <Outlet />
      </main>
      <KeyboardShortcutsHelp />
    </div>
  );
}
