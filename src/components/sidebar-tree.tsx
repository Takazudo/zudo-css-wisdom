"use client";

// Use preact hook entrypoints directly — the "react" → "preact/compat" alias
// lets us consume React-typed components in this Preact app (configured
// project-wide).
import { useState, useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import type { NavNode } from "@/utils/docs";
import type { LocaleLink } from "@/types/locale";
import { INDENT, BASE_PAD, connectorLeft, ConnectorLines, CategoryLinkIcon } from "./tree-nav-shared";
// BARE ThemeToggle (#2012 E2) — this footer toggle renders inside the
// SidebarToggle island, so it must NOT bring its own island wrapper.
import { ThemeToggle } from "@takazudo/zudo-doc/theme-toggle";
import { smartBreakToHtml } from "@/utils/smart-break";

function ToggleChevron({ isExpanded, className }: { isExpanded: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-[0.625rem] w-[0.625rem] shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""} ${className ?? ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

const STORAGE_KEY = "zd-sidebar-open";

function padLeft(depth: number, forCategory: boolean): string {
  if (depth === 0) return `calc(${BASE_PAD} + ${forCategory ? "0.15rem" : "0rem"})`;
  return `calc(${depth} * ${INDENT} + 1.25rem + 5px)`;
}

function getOpenSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveOpenSet(set: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function normalizePath(p: string): string {
  return p.replace(/\/$/, "") || "/";
}

/** Find the slug of the node whose href matches the given pathname */
function findActiveSlug(nodes: NavNode[], pathname: string): string | undefined {
  for (const node of nodes) {
    if (node.href && normalizePath(node.href) === pathname) return node.slug;
    const found = findActiveSlug(node.children, pathname);
    // "" is the canonical root-index slug (#1891) — a truthiness check
    // would discard a legitimate root match.
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Track current active slug, updating on View Transition navigations */
function useActiveSlug(nodes: NavNode[], initial?: string): string | undefined {
  const [slug, setSlug] = useState(initial);

  useEffect(() => {
    const update = () => {
      const pathname = normalizePath(window.location.pathname);
      const found = findActiveSlug(nodes, pathname);
      if (found !== undefined) setSlug(found);
    };
    update();
    // zfb's `<ViewTransitions />` does a real page load on every
    // navigation, so `DOMContentLoaded` is the post-navigate signal.
    document.addEventListener("DOMContentLoaded", update);
    return () => document.removeEventListener("DOMContentLoaded", update);
  }, [nodes]);

  return slug;
}

function filterTree(nodes: NavNode[], query: string): NavNode[] {
  return nodes.reduce<NavNode[]>((acc, node) => {
    const matchesLabel = node.label.toLowerCase().includes(query.toLowerCase());
    const filteredChildren = node.children.length > 0
      ? filterTree(node.children, query)
      : [];

    if (matchesLabel || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: matchesLabel ? node.children : filteredChildren,
      });
    }
    return acc;
  }, []);
}

interface RootMenuItem {
  label: string;
  href: string;
  children?: RootMenuItem[];
}

function RootMenuItemEntry({ item }: { item: RootMenuItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="border-t border-muted">
      <div className="flex items-center">
        <a
          href={item.href}
          className="flex flex-1 items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-small font-semibold text-fg hover:text-accent hover:underline break-words"
        >
          <CategoryLinkIcon className="w-[14px]" />
          <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(item.label) }} />
        </a>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center justify-center px-hsp-sm py-vsp-xs text-muted hover:text-fg"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          >
            <ToggleChevron isExpanded={expanded} className="text-muted" />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="pb-vsp-xs">
          {item.children!.map((child) => (
            <a
              key={child.href}
              href={child.href}
              className="block pl-hsp-xl pr-hsp-sm py-vsp-2xs text-small text-muted hover:text-accent hover:underline break-words"
            >
              <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(child.label) }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarTreeProps {
  nodes: NavNode[];
  currentSlug?: string;
  rootMenuItems?: RootMenuItem[];
  backToMenuLabel?: string;
  localeLinks?: LocaleLink[];
  themeDefaultMode?: "light" | "dark";
}

function SidebarFooter({ links, themeDefaultMode }: { links?: LocaleLink[]; themeDefaultMode?: "light" | "dark" }) {
  if (!links && !themeDefaultMode) return null;
  return (
    // pb-[50vh] provides scroll room so the footer doesn't sit at the very bottom of the viewport
    <div className="lg:hidden flex items-center gap-hsp-md border-t border-muted px-hsp-sm py-vsp-xs pb-[50vh] text-small">
      {themeDefaultMode && <ThemeToggle defaultMode={themeDefaultMode} />}
      {links && links.map((link, i) => (
        <span key={link.href} className="flex items-center gap-hsp-xs">
          {i > 0 && <span className="text-muted">/</span>}
          {link.active ? (
            <span aria-current="true" className="font-medium text-fg">{link.label}</span>
          ) : (
            <a href={link.href} lang={link.code} className="text-muted hover:text-fg">
              {link.label}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}

export default function SidebarTree({ nodes, currentSlug, rootMenuItems, backToMenuLabel, localeLinks, themeDefaultMode }: SidebarTreeProps) {
  const activeSlug = useActiveSlug(nodes, currentSlug);
  const [query, setQuery] = useState("");
  const [showingRootMenu, setShowingRootMenu] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);
  const [filterPlaceholder, setFilterPlaceholder] = useState("Filter...");

  // Detect OS to show appropriate keyboard shortcut in placeholder
  useEffect(() => {
    const platform = (navigator as { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform;
    const isMac = /mac/i.test(platform);
    setFilterPlaceholder(isMac ? "Filter... (\u2318 + /)" : "Filter... (Ctrl + /)");
  }, []);

  // Global shortcut: Cmd+/ (Mac) or Ctrl+/ to focus the filter input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        const el = filterRef.current;
        if (!el || el.offsetParent === null) return; // skip if hidden
        e.preventDefault();
        el.focus();
        el.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredNodes = useMemo(
    () => (query ? filterTree(nodes, query) : nodes),
    [nodes, query],
  );

  const footer = useMemo(
    () => (localeLinks || themeDefaultMode) ? <SidebarFooter links={localeLinks} themeDefaultMode={themeDefaultMode} /> : null,
    [localeLinks, themeDefaultMode],
  );

  // Root menu view: show headerNav items as a simple list (Docusaurus-style)
  if (showingRootMenu && rootMenuItems) {
    return (
      <nav>
        <button
          type="button"
          onClick={() => setShowingRootMenu(false)}
          className="flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
        >
          <svg className="h-icon-sm w-icon-sm shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {backToMenuLabel ?? "Back to main menu"}
        </button>
        {rootMenuItems.map((item) => (
          <RootMenuItemEntry key={item.href} item={item} />
        ))}
        {footer}
      </nav>
    );
  }

  // Top page: show only header nav links, no doc tree or filter.
  // Derived from activeSlug (runtime-synced) so it stays correct across View
  // Transitions. Must be an undefined check, not truthiness: "" is the
  // canonical root-index doc slug (#1891) and gets the full tree.
  if (activeSlug === undefined && rootMenuItems) {
    return (
      <nav>
        {rootMenuItems.map((item) => (
          <RootMenuItemEntry key={item.href} item={item} />
        ))}
        {footer}
      </nav>
    );
  }

  return (
    <nav>
      {rootMenuItems && (
        <button
          type="button"
          onClick={() => setShowingRootMenu(true)}
          className="lg:hidden flex w-full items-center gap-hsp-xs px-hsp-sm py-vsp-xs text-left text-small text-muted hover:text-fg border-b border-muted"
        >
          <svg className="h-icon-sm w-icon-sm shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {backToMenuLabel ?? "Back to main menu"}
        </button>
      )}
      <div className="px-hsp-sm py-vsp-xs">
        <div className="flex items-center gap-hsp-xs bg-surface rounded px-hsp-sm py-vsp-2xs">
          <svg className="h-[14px] w-[14px] text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={filterRef}
            type="text"
            placeholder={filterPlaceholder}
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
            className="bg-transparent text-small outline-none w-full text-fg placeholder:text-muted"
          />
        </div>
      </div>
      <NodeList
        nodes={filteredNodes}
        currentSlug={activeSlug}
        depth={0}
        forceOpen={!!query}
      />
      {footer}
    </nav>
  );
}

function NodeList({
  nodes,
  currentSlug,
  depth,
  forceOpen,
}: {
  nodes: NavNode[];
  currentSlug?: string;
  depth: number;
  forceOpen: boolean;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        return node.children.length > 0 ? (
          <CategoryNode
            key={node.slug}
            node={node}
            currentSlug={currentSlug}
            depth={depth}
            isLast={isLast}
            forceOpen={forceOpen}
          />
        ) : (
          <LeafNode
            key={node.slug}
            node={node}
            currentSlug={currentSlug}
            depth={depth}
            isLast={isLast}
          />
        );
      })}
    </>
  );
}

/** Check if currentSlug is anywhere in this node's subtree */
function subtreeContainsSlug(node: NavNode, slug?: string): boolean {
  if (!slug) return false;
  if (node.slug === slug) return true;
  return node.children.some((child) => subtreeContainsSlug(child, slug));
}

function CategoryNode({
  node,
  currentSlug,
  depth,
  isLast,
  forceOpen,
}: {
  node: NavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
  forceOpen: boolean;
}) {
  const containsCurrent = subtreeContainsSlug(node, currentSlug);
  const isActive = node.slug === currentSlug;

  // Initial state must match server render (no sessionStorage access)
  // to avoid hydration mismatch. Stored state is restored in useEffect below.
  const [open, setOpen] = useState(containsCurrent ? true : !node.collapsed);

  // Restore open state from sessionStorage after hydration
  useEffect(() => {
    const stored = getOpenSet();
    if (stored.has(node.slug) && !open) {
      setOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open category when navigation lands on a descendant
  useEffect(() => {
    if (subtreeContainsSlug(node, currentSlug) && !open) {
      setOpen(true);
      const stored = getOpenSet();
      stored.add(node.slug);
      saveOpenSet(stored);
    }
  }, [currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync auto-opened state to sessionStorage so it persists across View Transitions
  useEffect(() => {
    if (open) {
      const stored = getOpenSet();
      if (!stored.has(node.slug)) {
        stored.add(node.slug);
        saveOpenSet(stored);
      }
    }
  }, [open, node.slug]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const stored = getOpenSet();
      if (next) {
        stored.add(node.slug);
      } else {
        stored.delete(node.slug);
      }
      saveOpenSet(stored);
      return next;
    });
  }, [node.slug]);

  const isExpanded = forceOpen || open;
  const paddingLeft = padLeft(depth, true);

  return (
    <div className={`${depth === 0 ? "border-t border-muted" : ""} ${depth >= 1 && !isLast ? "relative" : ""}`}>
      {depth >= 1 && !isLast && isExpanded && (
        <div
          className="absolute border-l border-solid border-muted z-local-1"
          style={{
            left: connectorLeft(depth),
            top: 0,
            bottom: 0,
          }}
        />
      )}
      <div className="relative">
        <ConnectorLines depth={depth} isLast={isLast} topPad="calc(0.15rem + var(--spacing-vsp-xs))" />
        {node.href ? (
          <div
            className={`flex w-full items-center text-small font-semibold pt-[0.15rem] ${isActive ? "bg-fg text-bg" : "text-fg"}`}
          >
            <a
              href={node.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex items-start gap-hsp-xs py-vsp-xs hover:underline focus:underline break-words ${isActive ? "text-bg" : "text-fg"}`}
              style={{ paddingLeft }}
            >
              {depth === 0 && (
                <span className="flex h-[1lh] items-center">
                  <CategoryLinkIcon className={`w-[14px] ${isActive ? "text-bg" : ""}`} />
                </span>
              )}
              <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(node.label) }} />
            </a>
            <button
              type="button"
              onClick={toggle}
              className={`aspect-square flex items-center justify-center w-[1.5rem] border-y border-l hover:underline focus:underline ${isActive ? "border-bg/30" : "border-muted"}`}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            >
              <ToggleChevron isExpanded={isExpanded} className={isActive ? "text-bg" : "text-muted"} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className={`flex w-full items-center gap-hsp-md text-left text-small font-semibold py-vsp-xs text-fg hover:underline focus:underline break-words`}
            style={{ paddingLeft }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          >
            <span className="aspect-square flex items-center justify-center w-[1.5rem] shrink-0 border border-muted">
              <ToggleChevron isExpanded={isExpanded} className="text-muted" />
            </span>
            <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(node.label) }} />
          </button>
        )}
      </div>
      {isExpanded && (
        <div>
          <NodeList
            nodes={node.children}
            currentSlug={currentSlug}
            depth={depth + 1}
            forceOpen={forceOpen}
          />
        </div>
      )}
    </div>
  );
}

function LeafNode({
  node,
  currentSlug,
  depth,
  isLast,
}: {
  node: NavNode;
  currentSlug?: string;
  depth: number;
  isLast: boolean;
}) {
  if (!node.href) return null;
  const isActive = node.slug === currentSlug;
  const isRoot = depth === 0;
  const paddingLeft = padLeft(depth, isRoot);

  // For nested last leaves, add visual breathing space as margin on the outer wrapper
  // rather than padding on the anchor — padding would grow the row box and throw off
  // the ConnectorLines geometry (which now uses topPad + 0.5lh of the row to land the
  // horizontal connector at the first-line midpoint).
  const outerClass = isRoot
    ? "border-t border-muted"
    : !isRoot && isLast
      ? "pb-vsp-md"
      : "";

  const topPad = isRoot
    ? "calc(var(--spacing-vsp-xs) + 0.15rem)"
    : "var(--spacing-vsp-2xs)";

  return (
    <div className={outerClass}>
      <div className="relative">
        <ConnectorLines depth={depth} isLast={isLast} topPad={topPad} />
        <a
          href={node.href}
          aria-current={isActive ? "page" : undefined}
          className={isRoot
            ? `flex items-start gap-hsp-xs py-[calc(var(--spacing-vsp-xs)+0.15rem)] pr-[4px] text-small font-semibold break-words ${
                isActive ? "bg-fg text-bg" : "text-fg hover:underline focus:underline"
              }`
            : `block py-vsp-2xs pr-[4px] text-small break-words ${
                isActive
                  ? "bg-fg font-medium text-bg"
                  : "text-muted hover:underline focus:underline"
              }`
          }
          style={{ paddingLeft }}
        >
          {isRoot && (
            <span className="flex h-[1lh] items-center">
              <CategoryLinkIcon className={`w-[14px] ${isActive ? "text-bg" : ""}`} />
            </span>
          )}
          <span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(node.label) }} />
        </a>
      </div>
    </div>
  );
}
