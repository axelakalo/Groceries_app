import { Outlet } from 'react-router-dom';
import InstallPrompt from '../common/InstallPrompt';
import BottomTabNav from './BottomTabNav';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <Header />
      <main className="min-h-screen px-0 pb-24 pt-16 md:pl-24 md:pb-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="px-4 pt-4">
            <InstallPrompt />
          </div>
          <Outlet />
        </div>
      </main>
      <BottomTabNav />
    </div>
  );
}
