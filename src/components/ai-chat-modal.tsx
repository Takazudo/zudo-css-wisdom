// W6A stub — no-op default + AiChatModal named exports.
//
// The AiChatModal island now ships from the package
// (`@takazudo/zudo-doc/ai-chat-modal`); the unconditional
// `pages/lib/_body-end-islands.tsx` imports it directly from there. This
// stub exists only so any project-local code that references the
// `@/components/ai-chat-modal` path still resolves — it renders nothing.
// Replace this file to wire a project-specific modal.
import type { JSX } from "preact";

function AiChatModal(): JSX.Element | null {
  return null;
}
AiChatModal.displayName = "AiChatModal";

export default AiChatModal;

export { AiChatModal };
