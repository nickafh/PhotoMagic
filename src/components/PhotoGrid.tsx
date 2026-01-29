"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

type PhotoGridProps = {
  listingId: string;
  photoIds: string[];
  onReorder: (nextPhotoIds: string[]) => void;
};

// Preload images into browser cache
function preloadImages(listingId: string, photoIds: string[]) {
  photoIds.forEach((id) => {
    const img = new window.Image();
    img.src = `/api/photos/${id}?listingId=${listingId}&thumb=1`;
  });
}

export default function PhotoGrid({
  listingId,
  photoIds,
  onReorder,
}: PhotoGridProps) {
  const [localIds, setLocalIds] = useState<string[]>(photoIds);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const draggingRef = useRef(false);
  const preloadedRef = useRef(false);

  // Preload thumbnails on mount
  useEffect(() => {
    if (!preloadedRef.current && photoIds.length > 0) {
      preloadedRef.current = true;
      preloadImages(listingId, photoIds);
    }
  }, [listingId, photoIds]);

  useEffect(() => {
    if (!draggingRef.current) setLocalIds(photoIds);
  }, [photoIds]);

  // Use Mouse and Touch sensors for better performance
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(e.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      draggingRef.current = false;
      const { active, over } = e;

      setActiveId(null);

      if (!over || active.id === over.id) return;

      const oldIndex = localIds.indexOf(String(active.id));
      const newIndex = localIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(localIds, oldIndex, newIndex);
      setLocalIds(next);
      onReorder(next);
    },
    [localIds, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    draggingRef.current = false;
    setActiveId(null);
  }, []);

  const activeIndex = activeId ? localIds.indexOf(String(activeId)) : -1;

  if (localIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <span className="material-symbols-outlined text-6xl mb-4">add_photo_alternate</span>
        <p className="text-lg font-medium">No photos yet</p>
        <p className="text-sm">Upload photos to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={localIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {localIds.map((id, idx) => (
            <SortableTile
              key={id}
              id={id}
              index={idx + 1}
              listingId={listingId}
              isDragging={id === String(activeId)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <OverlayTile
            index={activeIndex >= 0 ? activeIndex + 1 : 0}
            listingId={listingId}
            photoId={String(activeId)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type SortableTileProps = {
  id: string;
  index: number;
  listingId: string;
  isDragging: boolean;
};

const SortableTile = memo(function SortableTile({
  id,
  index,
  listingId,
  isDragging,
}: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  // Use translate3d for GPU acceleration
  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition: transition ?? undefined,
    willChange: "transform",
    touchAction: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div
        className={`
          relative aspect-square rounded-xl overflow-hidden
          bg-slate-200 dark:bg-slate-800
          ${isDragging ? "opacity-30" : ""}
        `}
      >
        <img
          src={`/api/photos/${id}?listingId=${listingId}&thumb=1`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          loading={index <= 8 ? "eager" : "lazy"}
        />
        <div className="absolute bottom-2 right-2 w-7 h-7 bg-gold rounded-full flex items-center justify-center border-2 border-white shadow-md">
          <span className="text-xs font-bold text-white">{index}</span>
        </div>
      </div>
    </div>
  );
});

type OverlayTileProps = {
  index: number;
  listingId: string;
  photoId: string;
};

const OverlayTile = memo(function OverlayTile({ index, listingId, photoId }: OverlayTileProps) {
  return (
    <div
      style={{
        width: 160,
        height: 160,
        willChange: "transform",
        cursor: "grabbing",
      }}
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-2xl">
        <img
          src={`/api/photos/${photoId}?listingId=${listingId}&thumb=1`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-2 right-2 w-7 h-7 bg-gold rounded-full flex items-center justify-center border-2 border-white shadow-md">
          <span className="text-xs font-bold text-white">{index}</span>
        </div>
      </div>
    </div>
  );
});
