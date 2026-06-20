import { Tabs } from "@takazudo/zudo-doc/code-syntax";
import { TabItem } from "@takazudo/zudo-doc/tab-item";

/**
 * Adapter for zfb's `:::code-group` directive (codeTabs Option A).
 *
 * zfb emits:
 *   <CodeGroup tabs={["label1", "label2", ...]}>
 *     <pre data-lang="ts">{RAW code text}</pre>
 *     <pre data-lang="js">{RAW code text}</pre>
 *   </CodeGroup>
 *
 * The existing <Tabs>/<TabItem> UI uses a children-based API, so this
 * component zips the `tabs` label array with the `<pre data-lang>` children
 * by index, wrapping each in a <TabItem> with the matching label.
 *
 * Code inside each <pre> is raw text (NOT syntect-highlighted — the Rust
 * pipeline does not run highlight inside code-group fences). We render
 * the <pre> inside a <TabItem> with explicit styling via Tailwind tokens
 * so it looks like a code block visually.
 *
 * TabsInit (the companion init script) is present in the layout
 * (packages/zudo-doc/src/doclayout/doc-layout-with-defaults.tsx line 433)
 * — we rely on it being there; no duplicate needed here.
 */

type Props = {
  tabs?: string[];
  children?: React.ReactNode;
  [key: string]: unknown;
};

function toArray(children: React.ReactNode): React.ReactNode[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  return [children];
}

export function CodeGroup({ tabs = [], children, name }: Props) {
  const childArray = toArray(children);

  // Zip tabs labels with pre children by index. Extra children beyond the
  // tabs array (shouldn't happen in normal zfb output) are ignored.
  const items = tabs.map((label, i) => {
    const child = childArray[i];
    return { label, child };
  });

  if (items.length === 0) {
    // Degenerate: no tabs — render children as-is.
    return <>{children}</>;
  }

  // zfb forwards `:::code-group{name="x"}` as the `name` prop; Tabs persists
  // the active tab per group via `groupId`.
  const groupId = typeof name === "string" ? name : undefined;

  return (
    <Tabs groupId={groupId}>
      {items.map(({ label, child }, i) => (
        // value is suffixed with the index so two fences sharing a label
        // (e.g. both titled "ts") get distinct stable tab identities; the
        // label stays the visible text.
        <TabItem
          key={`${label}-${i}`}
          label={label}
          value={`${label}-${i}`}
          default={i === 0 ? true : undefined}
        >
          {/* Raw-code <pre> from zfb: apply code-block visual treatment via tokens */}
          <div class="code-group-panel">{child}</div>
        </TabItem>
      ))}
    </Tabs>
  );
}
