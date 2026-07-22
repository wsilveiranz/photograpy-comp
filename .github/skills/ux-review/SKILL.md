---
name: ux-review
description: "Use when any change affects the visual presentation, layout, or interaction of a React component — whether creating, modifying, or fixing. Provides the UX compliance checklist: touch targets (44px), design tokens, font sizes, disabled states, mobile-first layout rules, form consistency patterns."
---

# ux-review

Use this skill for every UI change in the app.

## Apply these steps to every UI change

1. **Reuse shared components first**
   - Check the existing shared components under `src/components` before creating a custom button, input, dialog, or layout primitive.
   - Use the project's class-merging helper (e.g. `cn()`) for conditional Tailwind classes rather than string concatenation.

2. **Enforce touch targets**
   - Put `min-h-[44px]` on every interactive element you add or modify: buttons, links, checkboxes, radio buttons, and icon-only controls (e.g. the vote button, upload button).
   - Make sure the control also has enough width to be tapped easily.
   - For checkbox and toggle rows, put `min-h-[44px]` on the wrapping `<label>`, not on the small control itself.
   - **Dialog footers**: keep paired action/cancel buttons the same height. Never override the height of only one footer button — mismatched heights look broken. If a footer button needs a custom height, apply the identical height to both.

3. **Set input typography correctly**
   - Apply `text-base` (16px) to every `<input>`, `<select>`, and `<textarea>`.
   - Do not use `text-sm` on form controls. This prevents iOS Safari auto-zoom.
   - Keep body text at `text-sm` or larger. Do not introduce user-facing `text-xs` copy.

4. **Use visible labels**
   - Give every form field a visible `<label>` matched with `htmlFor`/`id`.
   - Do not use placeholder text as the only label.

5. **Use approved colour and focus tokens**
   - Replace hardcoded hex colours with the project's design tokens (Tailwind theme colours / CSS variables). Do not scatter raw hex values.
   - Give interactive elements a visible focus ring (e.g. `ring-ring` / `focus:ring-*`).
   - Do not rely on colour alone to communicate status.

6. **Apply disabled states consistently**
   - Add `disabled:opacity-50 disabled:cursor-not-allowed` to disabled interactive elements.
   - Disable the vote button after a user has voted and the upload button once the 5-photo limit is reached, with clear visual feedback.

7. **Render errors and warnings in the standard pattern**
   - Render errors directly below the related input as `<p className="text-sm text-red-600">{message}</p>`.
   - Render warnings with `text-sm text-amber-600`.
   - Do not use `text-xs` for user-facing warnings or validation text.
   - Write descriptive text so meaning is clear without colour (e.g. "You've reached the 5-photo limit").

8. **Build mobile-first layouts**
   - Start with a stacked, single-column mobile layout. Add `sm:`/`md:` classes only after the mobile layout works.
   - Do not place `min-w-[N]` or fixed widths inside flex rows unless guarded by a breakpoint (`sm:min-w-[N]`).
   - Treat `flex justify-between` with two variable-width children as a warning sign; if the row is tight at 375px, switch to `flex-col sm:flex-row`.
   - Photo galleries/grids must not cause horizontal overflow at 375px; use a responsive grid that reflows.
   - Keep the primary CTA (vote / upload) visible without scrolling, or make it sticky.
   - Do not hide required information behind hover-only interactions (photos are viewed on touch devices).

9. **Show loading states during async actions**
   - For async buttons (upload, vote), render an inline spinner (`animate-spin`) with a descriptive label such as `Uploading…` or `Voting…`.
   - Show upload progress for photos where possible; never leave a button clickable with no feedback while a request is in progress.

10. **Match existing form/navigation patterns**
   - When adding a control to an existing form, follow the surrounding pattern and visual density instead of introducing a new one.
   - Before adding tabs or sub-navigation, copy the markup and tokens sibling pages already use. Do not introduce a second tab style.
   - Group navigation by the user's mental model (e.g. per-competition views), not by raw enum values.

11. **Run a final UX compliance pass before finishing**
   - Re-check touch targets, input font sizes, labels, colour tokens, disabled states, loading states, and mobile layout.
   - Review the changed component at a 375px viewport and confirm there is no clipped text or horizontal scrolling.
