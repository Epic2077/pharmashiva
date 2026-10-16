"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  /** Real (non-placeholder) image URLs, in source order. */
  images: string[];
  name: string;
}

/**
 * Detail-page image gallery: a hero image plus clickable thumbnails that swap
 * the hero. Remounted per product (keyed by id in the parent), so a plain
 * `useState` is enough.
 */
export default function ProductGallery({ images, name }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(images.length - 1, 0));
  const current = images[index];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-3xl border bg-muted/40">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={name}
            className="mx-auto h-60 w-full object-contain p-4 sm:h-80"
          />
        ) : (
          <div className="flex h-60 items-center justify-center text-muted-foreground sm:h-80">
            <Package className="size-16" />
          </div>
        )}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, imageIndex) => (
            <button
              key={`${url}-${imageIndex}`}
              type="button"
              onClick={() => setSelected(imageIndex)}
              aria-label={`Show image ${imageIndex + 1} of ${images.length}`}
              aria-current={imageIndex === index}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-xl border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                imageIndex === index
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${imageIndex + 1}`}
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
