import type { FavoriteItem } from '../../services/favoriteService';

interface FavoritesSectionProps {
  favorites: FavoriteItem[];
  onAdd: (favorite: FavoriteItem) => void;
}

export default function FavoritesSection({
  favorites,
  onAdd,
}: FavoritesSectionProps) {
  if (favorites.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <h2 className="font-semibold text-zinc-100">Favorites</h2>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
          {favorites.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        {favorites.map((favorite) => (
          <button
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-zinc-200 hover:border-blue-500/50 hover:text-blue-200"
            key={favorite.id}
            onClick={() => onAdd(favorite)}
            type="button"
          >
            <span className="text-amber-300">★</span>
            {favorite.name}
          </button>
        ))}
      </div>
    </section>
  );
}
