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
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import type { PhotoMeta } from "@/lib/types";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

type PhotoGridProps = {
  listingId: string;
  photoIds: string[];
  photos: Record<string, PhotoMeta>;
  onReorder?: (nextPhotoIds: string[]) => void;
  onToggleExclude?: (photoId: string) => void;
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
  photos,
  onReorder,
  onToggleExclude,
}: PhotoGridProps) {
  // Filter to only show non-excluded photos
  const activePhotoIds = photoIds.filter((id) => !photos[id]?.excluded);

  const [localIds, setLocalIds] = useState<string[]>(activePhotoIds);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
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
    if (!draggingRef.current) {
      setLocalIds(activePhotoIds);
    }
  }, [activePhotoIds.join(",")]);

  // Mouse and Touch sensors. On mobile, use longer delay so scroll isn't stolen; drag handle gives clear target.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: onReorder ? 5 : Infinity },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: onReorder ? 250 : Infinity, tolerance: 8 },
    })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(e.active.id);
    setOverId(null);
  }, []);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    setOverId(e.over?.id ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      draggingRef.current = false;
      const { active, over } = e;

      setActiveId(null);
      setOverId(null);

      if (!over || active.id === over.id || !onReorder) return;

      const oldIndex = localIds.indexOf(String(active.id));
      const newIndex = localIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(localIds, oldIndex, newIndex);
      setLocalIds(next);

      // Combine with excluded photos at the end for the full order
      const excludedIds = photoIds.filter((id) => photos[id]?.excluded);
      onReorder([...next, ...excludedIds]);
    },
    [localIds, photoIds, photos, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    draggingRef.current = false;
    setActiveId(null);
    setOverId(null);
  }, []);

  const activeIndex = activeId ? localIds.indexOf(String(activeId)) : -1;

  if (localIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">add_photo_alternate</span>
        </div>
        <p className="text-lg font-display text-slate-600 dark:text-slate-300 mb-1">No photos yet</p>
        <p className="text-sm text-slate-400">Upload photos to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={localIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4 stagger-children">
          {localIds.map((id, idx) => (
            <SortableTile
              key={id}
              id={id}
              index={idx + 1}
              listingId={listingId}
              isDragging={id === String(activeId)}
              isDropTarget={id === String(overId)}
              onExclude={onToggleExclude ? () => onToggleExclude(id) : undefined}
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
  isDropTarget: boolean;
  onExclude?: () => void;
};

const SortableTile = memo(function SortableTile({
  id,
  index,
  listingId,
  isDragging,
  isDropTarget,
  onExclude,
}: SortableTileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      {/* Exclude button above drag overlay so it stays clickable on desktop */}
      {onExclude && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExclude();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`
            absolute top-2 left-2 z-20 w-8 h-8
            hidden md:flex
            bg-red-500/90 hover:bg-red-600 backdrop-blur-sm
            rounded-full items-center justify-center
            border-2 border-white/90 shadow-lg
            transition-all duration-200
            ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90"}
          `}
          title="Mark as Do Not Use"
        >
          <span className="material-symbols-outlined text-white text-base">close</span>
        </button>
      )}

      {/* One drag target: on mobile a small handle (avoids stealing scroll); on desktop the whole tile. */}
      {isMobile ? (
        <div
          className="absolute top-1 left-1 right-1 z-10 flex justify-center py-2 rounded-t-lg bg-black/50 touch-none cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          {...attributes}
          {...listeners}
          aria-label="Hold to drag and reorder"
        >
          <span className="material-symbols-outlined text-white/90 text-lg">drag_indicator</span>
        </div>
      ) : (
        <div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder photo"
          {...attributes}
          {...listeners}
        />
      )}
      <div
        className={`
          photo-tile
          ${isDragging ? "opacity-30 scale-95" : ""}
          ${!isDragging && "md:hover:shadow-xl md:hover:-translate-y-1"}
          ${isDropTarget ? "ring-4 ring-gold ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 shadow-lg shadow-gold/20" : ""}
        `}
      >
        <img
          src={`/api/photos/${id}?listingId=${listingId}&thumb=1`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.03]"
          draggable={false}
          loading={index <= 8 ? "eager" : "lazy"}
        />

        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Number badge - premium gold gradient */}
        <div
          className={`
            photo-badge
            bottom-1 right-1 w-5 h-5
            md:bottom-2.5 md:right-2.5 md:w-8 md:h-8
            text-[9px] md:text-sm
            ${!isDragging && "md:group-hover:scale-110"}
          `}
        >
          {index}
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
      className="animate-scale-in"
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-2xl ring-4 ring-gold/30">
        <img
          src={`/api/photos/${photoId}?listingId=${listingId}&thumb=1`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-105"
          draggable={false}
        />
        <div className="photo-badge bottom-2.5 right-2.5 w-8 h-8 text-sm scale-110">
          {index}
        </div>
      </div>
    </div>
  );
});
