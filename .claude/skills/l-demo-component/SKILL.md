---
name: l-demo-component
description: >-
  Guidance for using CssPreview component in zcss documentation articles.
  Use when: (1) Writing or editing CssPreview demos in MDX articles, (2) Deciding whether to use
  defaultOpen={true} or false, (3) User asks about demo component usage patterns.
user-invocable: true
argument-hint: "[question about demo component usage]"
---

# Demo Component Usage Guide

For CssPreview basics, rendering behavior, and CSS conventions, invoke `/l-writing`, the authoritative authoring skill for this repository.

This skill covers **decision patterns** for effective demo usage.

## defaultOpen Prop

Controls whether the code panel is expanded on first render.

| Situation | defaultOpen | Rationale |
| --- | --- | --- |
| Explaining a concept — demo illustrates it | `false` (default) | Reader focuses on visual result first |
| Showing code for confirmation | `true` | Reader needs code + result side by side |
| Listing variety of visual patterns | `false` (default) | Visual comparison is primary goal |

## Demo Sizing Tips

- Set `height` to avoid layout shift — estimate from content, typically 200-400px
- For comparison demos, use side-by-side layout with `display: flex; gap: 32px`
- For responsive demos, keep breakpoints under 768px so tablet/mobile presets show differences

## Media Query Remapping

CssPreview iframe widths: Mobile=320px, Tablet=768px, Full=~900-1100px.

If production code uses breakpoints like 1024px or 1280px, remap to smaller values (e.g., 500px, 700px) so the demo visually demonstrates the responsive behavior within the iframe.

## Multiple Demos Per Article

Prefer **more demos over more prose**. Each distinct CSS behavior should have its own CssPreview. A good article has 3-6 demos with brief explanatory text between them.
