import { Link } from 'react-router-dom';

const actions = [
  { label: 'Add Grocery', to: '/app/grocery', icon: 'M6 6h15l-2 8H8L6 3H3M9 20h.01M18 20h.01M14 8v4M12 10h4' },
  { label: 'Add Pantry', to: '/app/pantry', icon: 'M5 4h14v17H5V4ZM8 4v17M16 4v17M5 11h14M11 7h2M11 15h2' },
  { label: 'Scan', to: '/app/scan', icon: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M7 12h10M9 9h6M9 15h6M8 20H5a1 1 0 0 1-1-1v-3M20 16v3a1 1 0 0 1-1 1h-3' },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action) => (
        <Link
          className="group flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2 text-center shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-blue-500/40"
          key={action.to}
          to={action.to}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300 transition-colors group-hover:bg-blue-500 group-hover:text-white">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={action.icon}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </span>
          <span className="text-xs font-medium text-zinc-300">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
