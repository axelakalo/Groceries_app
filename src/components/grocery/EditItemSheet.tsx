import type { GroceryItem, GroceryItemInput } from '../../services/groceryService';
import GroceryItemSheet from './GroceryItemSheet';

interface EditItemSheetProps {
  item: GroceryItem;
  onClose: () => void;
  onSubmit: (item: GroceryItemInput) => Promise<void>;
}

export default function EditItemSheet({
  item,
  onClose,
  onSubmit,
}: EditItemSheetProps) {
  return (
    <GroceryItemSheet
      item={item}
      mode="edit"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
