# Plan: LANDING-005 - Implement Footer RSC Section with Real External Links

## Overview
Implement `Footer` as a landing React Server Component at `apps/demo/src/components/landing/Footer.tsx` and render it from the home route. The component must use semantic footer markup, include a top border separator, and expose two secure external links:
- GitHub: `https://github.com/feltroidprime/s2morrow`
- Starknet Docs: `https://docs.starknet.io`

Approach is strict TDD: write failing tests first (unit, then integration), implement component, wire route, then verify.

## TDD Step Order (Tests First)
1. Modify `apps/demo/src/tests/landing/footer.test.ts` to import `Footer` and add `renderFooter(): string` helper using `renderToStaticMarkup`.
2. Add a failing unit test asserting the root element is a semantic `<footer>` and includes `border-t` in class list.
3. Add a failing unit test asserting `GitHub` link exists and `href="https://github.com/feltroidprime/s2morrow"`.
4. Add a failing unit test asserting `Starknet Docs` link exists and `href="https://docs.starknet.io"`.
5. Add a failing unit test asserting both links include `target="_blank"` and `rel="noopener noreferrer"`.
6. Add a failing unit test asserting descriptive aria labels are present: `View source on GitHub` and `Read Starknet documentation`.
7. Add a failing unit test asserting RSC constraints: no `"use client"` directive in source and no `<script>` tags in rendered HTML.
8. Create `apps/demo/src/tests/landing/footer.page.integration.test.ts` with a failing test that `Home` markup includes footer content and both external links.
9. Implement `apps/demo/src/components/landing/Footer.tsx` to satisfy all unit assertions.
10. Modify `apps/demo/src/app/page.tsx` to import and render `<Footer />` at the end of `<main>` so integration test passes.
11. Run focused tests first, then broader verification commands.

## Files to Create/Modify (with function signatures)
1. Create `apps/demo/src/components/landing/Footer.tsx`
- `export function Footer(): React.JSX.Element`

2. Modify `apps/demo/src/tests/landing/footer.test.ts`
- `function renderFooter(): string`
- Replace existing `test.todo` placeholders with concrete assertions.

3. Create `apps/demo/src/tests/landing/footer.page.integration.test.ts`
- `function renderHomePage(): string`
- Integration assertions for `Home` route composition.

4. Modify `apps/demo/src/app/page.tsx`
- Keep `export default function Home(): React.JSX.Element`
- Add `import { Footer } from "../components/landing/Footer"` and render `<Footer />`.

## Tests to Write
### Unit tests (`apps/demo/src/tests/landing/footer.test.ts`)
1. Renders semantic `<footer>` element.
2. Footer class list includes `border-t` separator.
3. Renders `GitHub` link pointing to `https://github.com/feltroidprime/s2morrow`.
4. Renders `Starknet Docs` link pointing to `https://docs.starknet.io`.
5. Both links include `target="_blank"`.
6. Both links include `rel="noopener noreferrer"`.
7. GitHub link has `aria-label="View source on GitHub"`.
8. Starknet Docs link has `aria-label="Read Starknet documentation"`.
9. RSC safety checks: source has no `"use client"`; rendered markup has no `<script`.

### Integration tests (`apps/demo/src/tests/landing/footer.page.integration.test.ts`)
1. `Home` route includes footer text and `GitHub` / `Starknet Docs` labels.
2. `Home` route includes required external link URLs.
3. `Home` route retains secure link attributes for both anchors.

### Verification commands
- `cd apps/demo && bun test src/tests/landing/footer.test.ts`
- `cd apps/demo && bun test src/tests/landing/footer.page.integration.test.ts`
- `cd apps/demo && bun test src/tests/landing`
- `cd apps/demo && bun run typecheck`

## Risks and Mitigations
1. Risk: Wrong GitHub URL copied from stale scaffolds (`s2morrow/s2morrow`).
- Mitigation: lock tests to `https://github.com/feltroidprime/s2morrow` from current `origin` remote.

2. Risk: HTML-string tests become brittle if class ordering changes.
- Mitigation: assert stable substrings/attributes (`<footer`, `href=`, `target=`, `rel=`, `aria-label=`) rather than full snapshots.

3. Risk: Footer implemented but not wired into `Home` route.
- Mitigation: add dedicated page integration test that renders `Home` and asserts footer presence.

4. Risk: Accidentally introducing client behavior into landing component.
- Mitigation: explicit unit assertion for no `"use client"` directive and no script tags.

## Verification Against Acceptance Criteria
1. Real GitHub repository link: unit + integration tests assert exact `https://github.com/feltroidprime/s2morrow`.
2. Starknet Docs link: unit + integration tests assert exact `https://docs.starknet.io`.
3. External-link security attributes: unit + integration tests assert `target="_blank"` and `rel="noopener noreferrer"` on both links.
4. Accessibility labels: unit tests assert descriptive `aria-label` values for each link.
5. Semantic/footer separator requirement: unit tests assert `<footer>` and `border-t` class.
6. RSC requirement: unit tests assert no `"use client"` and no inline script tags.
