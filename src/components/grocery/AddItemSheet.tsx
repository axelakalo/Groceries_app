import type { GroceryItemInput } from '../../services/groceryService';
import GroceryItemSheet from './GroceryItemSheet';

interface AddItemSheetProps {
  onClose: () => void;
  onSubmit: (item: GroceryItemInput) => Promise<void>;
}

export default function AddItemSheet({ onClose, onSubmit }: AddItemSheetProps) {
  return <GroceryItemSheet mode="add" onClose={onClose} onSubmit={onSubmit} />;
}
