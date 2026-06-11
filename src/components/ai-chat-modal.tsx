"use client";

// W6A stub — no-op default export.
//
// The host (zudo-doc showcase) ships a full AI-chat modal island here. In
// generated downstream projects the AI assistant is gated behind a future
// settings flag; for now the file exists so unconditional page imports
// (`pages/lib/_body-end-islands.tsx`) resolve, and the component renders
// nothing. Wire a real implementation by replacing this file.
import type { JSX } from "preact";

function AiChatModal(): JSX.Element | null {
  return null;
}
AiChatModal.displayName = "AiChatModal";

export default AiChatModal;
