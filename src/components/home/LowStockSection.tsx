import {
  getPantryItemName,
  type PantryItem,
} from '../../services/pantryService';

interface LowStockSectionProps {
  items: PantryItem[];
  onAddToGrocery: (item: PantryItem) => void;
}

export default function LowStockSection({
  items,
  onAddToGrocery,
}: LowStockSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
      <div className="h-1 w-full bg-amber-400" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-zinc-100">Low stock</h2>
            <p className="text-sm text-zinc-500">
              {items.length} item{items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">
                  {getPantryItemName(item)}
                </p>
                <p className="text-sm text-zinc-500">
                  {Number(item.quantity)} left
                  {item.low_stock_threshold
                    ? `, threshold ${Number(item.low_stock_threshold)}`
                    : ''}
                </p>
              </div>
              <button
                className="h-10 shrink-0 rounded-xl bg-blue-500 px-3 text-sm font-semibold text-white hover:bg-blue-400"
                onClick={() => onAddToGrocery(item)}
                type="button"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
