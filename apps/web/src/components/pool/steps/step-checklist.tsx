'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ChecklistItemData {
  id: string;
  folderId: number;
  label: string;
  description: string;
  requirementLevel: 'required' | 'recommended' | 'optional';
  expectedDocType: number;
  sortOrder: number;
}

interface StepChecklistProps {
  items: ChecklistItemData[];
  onItemsChange: (items: ChecklistItemData[]) => void;
}

const REQUIREMENT_CYCLE: Array<'required' | 'recommended' | 'optional'> = [
  'required',
  'recommended',
  'optional',
];

const REQUIREMENT_STYLES: Record<string, string> = {
  required: 'bg-blue-100 text-blue-700',
  recommended: 'bg-amber-100 text-amber-700',
  optional: 'bg-slate-100 text-slate-600',
};

function SortableItem({
  item,
  onToggleRequirement,
  onRemove,
}: {
  item: ChecklistItemData;
  onToggleRequirement: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2.5"
    >
      <button
        type="button"
        className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{item.label}</span>
      <button
        type="button"
        onClick={onToggleRequirement}
        className={`text-xs font-medium px-2 py-0.5 rounded-md ${REQUIREMENT_STYLES[item.requirementLevel]}`}
      >
        {item.requirementLevel.charAt(0).toUpperCase() +
          item.requirementLevel.slice(1)}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function StepChecklist({ items, onItemsChange }: StepChecklistProps) {
  const [newItemLabel, setNewItemLabel] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sortOrder: idx,
    }));
    onItemsChange(reordered);
  }

  function toggleRequirement(id: string) {
    onItemsChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const currentIdx = REQUIREMENT_CYCLE.indexOf(item.requirementLevel);
        const nextLevel =
          REQUIREMENT_CYCLE[(currentIdx + 1) % REQUIREMENT_CYCLE.length];
        return { ...item, requirementLevel: nextLevel };
      }),
    );
  }

  function removeItem(id: string) {
    if (items.length <= 1) return; // minimum 1 item
    onItemsChange(items.filter((i) => i.id !== id));
  }

  function addCustomItem() {
    if (!newItemLabel.trim()) return;
    const newItem: ChecklistItemData = {
      id: crypto.randomUUID(),
      folderId: 5, // Misc folder
      label: newItemLabel.trim(),
      description: '',
      requirementLevel: 'optional',
      expectedDocType: 9, // MISC
      sortOrder: items.length,
    };
    onItemsChange([...items, newItem]);
    setNewItemLabel('');
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onToggleRequirement={() => toggleRequirement(item.id)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Input
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
          placeholder="Add custom checklist item..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomItem}
          disabled={!newItemLabel.trim()}
        >
          Add
        </Button>
      </div>
      {items.length <= 1 && (
        <p className="text-xs text-muted-foreground">
          At least one checklist item is required.
        </p>
      )}
    </div>
  );
}
