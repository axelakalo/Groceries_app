import { NavLink } from 'react-router-dom';
import { navItems } from './navItems';

export default function BottomTabNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden">
      <div className="grid grid-cols-5 gap-1 rounded-3xl border border-zinc-800/80 bg-zinc-950/85 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {navItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-semibold transition-all ${
                isActive
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/35'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              }`
            }
            end={item.end}
            key={item.to}
            to={item.to}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
