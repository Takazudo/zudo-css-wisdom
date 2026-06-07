import { settings } from "@/config/settings";
import type { HeaderRightItem } from "@/config/settings-types";

function isDesignTokenPanelEnabled(): boolean {
  return Boolean(settings.designTokenPanel);
}

export function filterHeaderRightItems(
  items: HeaderRightItem[],
): HeaderRightItem[] {
  return items.filter((item) => {
    if (item.type === "trigger") {
      if (item.trigger === "design-token-panel") {
        return isDesignTokenPanelEnabled();
      }
      if (item.trigger === "ai-chat") {
        return Boolean(settings.aiAssistant);
      }
    }

    if (item.type === "component") {
      if (item.component === "theme-toggle") {
        return Boolean(settings.colorMode);
      }
      if (item.component === "language-switcher") {
        return Object.keys(settings.locales).length > 0;
      }
      if (item.component === "version-switcher") {
        return Boolean(settings.versions);
      }
      if (item.component === "github-link") {
        return Boolean(settings.githubUrl);
      }
    }

    return true;
  });
}
