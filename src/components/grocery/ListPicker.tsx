import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GroceryList } from '../../services/groceryService';

interface ListPickerProps {
  lists: GroceryList[];
  activeListId: string | null;
  onCreate: () => void;
  onSelect: (listId: string) => void;
  onRename: (list: GroceryList) => void;
  onDelete: (list: GroceryList) => void;
}

const LONG_PRESS_MS = 500;

interface PopupState {
  list: GroceryList;
  x: number;
  y: number;
}

function ListContextMenu({
  popup,
  onRename,
  onDelete,
  onClose,
}: {
  popup: PopupState;
  onRename: (list: GroceryList) => void;
  onDelete: (list: GroceryList) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // slight delay so the triggering touchend/mouseup doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleDown);
      document.addEventListener('touchstart', handleDown);
      document.addEventListener('keydown', handleKey);
    }, 50);

    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp so the menu never goes off the right edge
  const menuWidth = 168;
  const left = Math.min(popup.x, window.innerWidth - menuWidth - 8);

  return createPortal(
    <div
      ref={menuRef}
      aria-label={`Options for ${popup.list.name}`}
      className="fixed z-[200] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60"
      role="menu"
      style={{ top: popup.y, left, width: menuWidth }}
    >
      {/* Accent stripe */}
      <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />

      <div className="py-1">
        <p className="truncate px-3 pb-1 pt-2 text-xs font-bold text-zinc-500">
          {popup.list.name}
        </p>

        <button
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
          onClick={() => { onRename(popup.list); onClose(); }}
          role="menuitem"
          type="button"
        >
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
              stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
            />
          </svg>
          Rename list
        </button>

        {popup.list.is_default ? (
          <p className="px-3 py-2.5 text-xs text-zinc-600">
            Default list can't be deleted
          </p>
        ) : (
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            onClick={() => { onDelete(popup.list); onClose(); }}
            role="menuitem"
            type="button"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
              />
            </svg>
            Delete list
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ListTab({
  list,
  isActive,
  onSelect,
  onLongPress,
}: {
  list: GroceryList;
  isActive: boolean;
  onSelect: () => void;
  onLongPress: (rect: DOMRect) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const startPress = useCallback(() => {
    didLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) onLongPress(rect);
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    cancelPress();
    if (!didLongPressRef.current) {
      onSelect();
    }
  }, [cancelPress, onSelect]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      ref={buttonRef}
      aria-pressed={isActive}
      className={`relative h-11 select-none rounded-xl px-4 text-sm font-semibold transition-all ${
        isActive
          ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/30'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
      }`}
      onClick={handleClick}
      onMouseDown={startPress}
      onMouseLeave={cancelPress}
      onMouseUp={cancelPress}
      onTouchEnd={(e) => { e.preventDefault(); cancelPress(); if (!didLongPressRef.current) onSelect(); }}
      onTouchMove={cancelPress}
      onTouchStart={(e) => { e.preventDefault(); startPress(); }}
      type="button"
    >
      {list.name}
      {/* Subtle visual hint that it's long-pressable */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl transition-all active:bg-white/10"
      />
    </button>
  );
}

export default function ListPicker({
  lists,
  activeListId,
  onCreate,
  onSelect,
  onRename,
  onDelete,
}: ListPickerProps) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  function handleLongPress(list: GroceryList, rect: DOMRect) {
    setPopup({
      list,
      // Position below the tab, aligned to its left edge
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex min-w-max gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-1.5">
          {lists.map((list) => (
            <ListTab
              key={list.id}
              isActive={activeListId === list.id}
              list={list}
              onLongPress={(rect) => handleLongPress(list, rect)}
              onSelect={() => onSelect(list.id)}
            />
          ))}

          {/* Add list button */}
          <button
            aria-label="Create new list"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            onClick={onCreate}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor" strokeLinecap="round" strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </div>

      {popup ? (
        <ListContextMenu
          popup={popup}
          onClose={() => setPopup(null)}
          onDelete={onDelete}
          onRename={onRename}
        />
      ) : null}
    </>
  );
}
