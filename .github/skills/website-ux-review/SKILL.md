---
name: website-ux-review
description: |
  Performs a human-style UX review of a website's look & feel and usability, producing a
  prioritised, severity-ranked list of findings in a senior-practitioner voice. Works from a
  screenshot, a URL, pasted HTML, or a written description.
  Use when the user asks to "review my website", "do a UX review", "review the look and feel",
  "critique this landing page", "design review of this site", "what do you think of this page's
  design", or "how's the UX on this". Covers visual hierarchy, typography, colour & contrast,
  layout, imagery, brand consistency, navigation, content, interaction states, responsive/mobile,
  accessibility, performance, and the primary action.
  Do NOT use for building or coding the site, a full copy rewrite (use writing-standards instead),
  or automated SEO / performance / Lighthouse audits.
cowork:
  category: analysis
  icon: PaintBrush
---

## Overview

Reviews a website the way an experienced designer would: open it cold, react honestly, then work
through it area by area and leave a prioritised list of fixes — not a pile of opinions. Every finding
names where it is, what's wrong, why it matters, and the fix, with a severity so the reader knows what
to do first. The voice is a senior practitioner: direct, specific, numbers over adjectives, no filler.

## When to Use

- The user points at a site, page, or screenshot and wants a UX or "look & feel" review.
- The user asks whether a design "works", reads as trustworthy/modern, or where it loses people.
- The user wants a prioritised fix list they can hand to a designer or developer.

## When NOT to Use

- Building, coding, or implementing the changes — out of scope; this is judgement, not a build.
- A full copy or content rewrite — use `writing-standards`.
- An automated SEO, performance, or Lighthouse audit that needs a crawler or real metrics — this gives
  UX judgement, not machine-measured numbers.
- A general web-design theory question with no specific site or screenshot — just answer directly.

## Quick Start

```
User: "Can you do a UX review of my landing page?" (+ a screenshot or URL)
1. Identify the input: screenshot in input/, a URL, pasted HTML, or a description.
2. Gather it: Read the image(s), or web_fetch the URL for copy/structure/IA.
3. First impressions — the 60-second gut check.
4. Work the 14 areas; note location + what's wrong + why + fix for each finding.
5. Assign severity; separate measurable issues from taste; sort and pull out quick wins.
6. Write it up in the human voice and present the prioritised findings.
```

## Core Instructions

### Step 1 — Figure out what you're reviewing

Identify the source, in this order:

- **Screenshot(s)** — `Glob input/**/*.{png,jpg,jpeg,webp}` then `Read` them. This is the best source for
  look & feel; a full-page screenshot is ideal.
- **A URL** — `web_fetch` it. Fetched HTML gives you copy, structure, headings, links, and IA, but **not
  the rendered look**. Say so, and offer to go deeper on a screenshot for the visual pass.
- **Pasted HTML or a written description** — work from what you were given.
- **Nothing concrete** — ask once (`AskUserQuestion`) for a URL or a screenshot, then proceed.

Always name the source's limits in the review — e.g. "reviewed from one desktop screenshot, so I
couldn't test mobile, hover states, or load time."

### Step 2 — First impressions (the 60-second gut check)

Capture the honest first reaction **before** analysing — you only get it once. In one short paragraph:
what is this and who's it for (could you tell in five seconds?), what's the obvious next action, does it
feel current and trustworthy, and where did your eye land first.

### Step 3 — Work the 14 areas

Go through each, noting findings as you go. Key thresholds are baked in so you can be specific:

1. **Visual hierarchy** — squint: does the eye land on the headline + primary action, or fight competing
   elements? One clear focal point per screen. Primary action visually louder than everything else.
2. **Typography** — clear type scale; body ≥ 16px desktop; line length 50–75 characters; line height ~1.5;
   two typefaces at most; consistent alignment.
3. **Colour & contrast** — disciplined palette with the accent reserved for actions; body text ≥ 4.5:1,
   large text ≥ 3:1 (WCAG AA); never colour alone for meaning; consistent meaning per colour.
4. **Layout, spacing & alignment** — consistent spacing rhythm (proximity), alignment to a grid, breathing
   room, a sensible content max-width on large screens.
5. **Imagery & iconography** — crisp, consistent style, real over stock, one icon set/weight, alt text.
6. **Brand & consistency** — buttons/links/cards/forms styled the same everywhere; the fifth page looks
   like the first; consistent tone.
7. **Navigation & IA** — labels in the visitor's words; a scannable menu; clear "where am I?"; obvious way
   home and to the primary action; mobile nav that isn't a hamburger hiding everything.
8. **Content & messaging** — headline says what you do and for whom; scannable copy; plain language; CTAs
   that name the outcome ("Start free trial", not "Submit"); benefits before features.
9. **Interaction, states & feedback** — interactive things look interactive; visible hover **and focus**
   states; feedback on every action; forms with real labels, helpful inline validation, and errors that
   say how to fix; targets ≥ 44×44px; motion 150–300ms and respects reduce-motion.
10. **Responsive & mobile** — clean single-column reflow, no horizontal scroll, thumb-sized targets,
    primary action reachable; test real devices, not just responsive mode.
11. **Accessibility** — AA contrast, full keyboard operation with visible focus, real alt text, semantic
    structure (one H1, real buttons/links), labels tied to fields, nothing by colour alone, zoom to 200%.
12. **Performance & perceived speed** — quick first paint, no layout shift (watch CLS), compressed/lazy
    images, skeletons for slow parts. Only state a metric you actually measured; otherwise flag it as
    "worth checking", don't invent a number.
13. **Trust & credibility** — trust signals where decisions happen, honest/current content, real contact
    details, a footer that isn't empty.
14. **The primary action (conversion)** — one clear primary action per page, low friction on the important
    path, a clear next step at the end of every page — never a dead end.

Separate what's **measurably off** (contrast below 4.5:1, tap target under 44px, a horizontal scroll) from
what's a **judgement call** (a layout that feels cluttered). Both belong in the review; the reader should
know which is which.

### Step 4 — Severity & priority

Give every finding a severity, then sort:

- **Blocker** — stops a core task (broken form, unreadable text, no mobile access). Fix now.
- **High** — real friction or a credibility hit that costs conversions. Fix this cycle.
- **Medium** — noticeable, worth fixing, not urgent. Schedule it.
- **Low / polish** — nitpicks and nice-to-haves. Batch them.

Sort by severity, then by impact vs effort. Lead with the high-impact, low-effort wins (a contrast fix,
one button relabel, a spacing pass).

### Step 5 — Write it up (human voice)

- Prefer a number to an adjective: "body text ~3:1, fails AA" beats "hard to read".
- Be specific about location: "pricing page, second card", not "somewhere on pricing".
- Pair every problem with a recommendation.
- No AI-slop words — seamless, robust, leverage, elevate, unlock, game-changing, cutting-edge. Short,
  plain sentences. (`writing-standards` handles deeper prose cleanup if the write-up is long.)

## Output

Default to an inline markdown review, in this shape:

1. **First impressions** — 2–4 plain, specific sentences (the gut check).
2. **Findings** — a table sorted by severity: `# | Location | What's wrong | Why it matters | Fix | Severity`.
   Use a `render_ui` card only when there are 4+ findings and it genuinely helps; otherwise a markdown table.
3. **Quick wins** — the 2–3 high-impact, low-effort fixes to do first.
4. A one-line offer to export the review as a Word document (hand off to the `docx` skill) if they want to
   share it.

Keep it scannable. Don't restate the framework back to the user; give them the findings.

## Guardrails

- **Ground every finding in what you can actually see or fetch.** Never invent details, describe a
  screenshot you weren't given, or state a metric you didn't measure (no made-up load times or Lighthouse
  scores). If you can't see it, say "worth checking" instead of asserting.
- **URL-only reviews are partial** — fetched HTML shows content and structure, not the rendered look.
  Say the visual pass is limited and offer to go deeper on a screenshot.
- **Name standards correctly** — WCAG AA is 4.5:1 body / 3:1 large; touch targets 44×44px. Don't misquote.
- **Stay in your lane** — review, don't build. A full copy rewrite goes to `writing-standards`; coding or
  implementing the fixes is out of scope.
- **No performance evaluation of people** — this reviews the site, not whoever made it.
