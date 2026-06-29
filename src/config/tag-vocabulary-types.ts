// Re-export from the shared package — canonical definitions live in
// @takazudo/zudo-doc/settings (epic #2321). Consumers that import from
// this local path continue to work unchanged.
export type { TagGovernanceMode, TagVocabularyEntry } from "@takazudo/zudo-doc/settings";
