import { NavLink } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { navItems } from './navItems';

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-24 flex-col items-center border-r border-zinc-800/70 bg-zinc-950/80 px-3 py-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:flex">
      <NavLink
        aria-label={APP_NAME}
        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-sm font-black text-white shadow-lg shadow-blue-950/40 transition-all hover:-translate-y-0.5 hover:bg-blue-400"
        to="/app"
      >
        <span>
          PS
        </span>
        <span className="pointer-events-none absolute left-full ml-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 opacity-0 shadow-xl shadow-black/30 transition-all group-hover:translate-x-1 group-hover:opacity-100">
          {APP_NAME}
        </span>
      </NavLink>

      <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `group relative flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/35'
                  : 'text-zinc-400 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-zinc-100'
              }`
            }
            end={item.end}
            key={item.to}
            to={item.to}
            aria-label={item.label}
          >
            {item.icon}
            <span className="pointer-events-none absolute left-full ml-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 opacity-0 shadow-xl shadow-black/30 transition-all group-hover:translate-x-1 group-hover:opacity-100">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
