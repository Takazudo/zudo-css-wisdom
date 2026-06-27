"use client";

// Re-export shim for the ImageEnlarge island.
//
// The real component and its SSR fallback now ship in the package at
// @takazudo/zudo-doc/image-enlarge (epic #2344, S3).
// pages/lib/_body-end-islands.tsx imports them directly from there; this
// overlay overwrites the base W6A no-op stub so that any project-local
// code referencing the @/components/image-enlarge path resolves to the
// real island when the imageEnlarge feature is enabled.
export { ImageEnlarge, ImageEnlargeSsrFallback } from "@takazudo/zudo-doc/image-enlarge";
