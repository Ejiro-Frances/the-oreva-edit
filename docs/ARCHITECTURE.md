# The Oreva Edit — implementation decisions

## Discovery (2 October 2026)

Reviewed [Awwwards fashion](https://www.awwwards.com/websites/fashion/), [COS catalogue](https://www.cos.com/en-us/women/new-arrivals), [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Mailgun HTTP delivery](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http), [Unsplash licensing](https://unsplash.com/license), and Google Fonts specimens for Cormorant Garamond and Manrope. Land-book was inaccessible. Inspiration is used for principles, never copied assets or brand identity.

The design combines photographic storytelling with compact shopping controls: an asymmetric campaign, warm surfaces, wine accents, open product grids, and visible prices. Avoid carousel dependence, deceptive urgency and decorative dashboard cards. Product photography is provisional and must be replaced before real sales.

## Plan before implementation

1. **Visual direction:** bone, oxblood, ink and muted olive. Cormorant Garamond display plus Manrope text. Lucide line icons; square edges, generous space, minimal motion.
2. **Information architecture:** editorial home → audience/category/collection → product → bag → guest checkout. Accounts and administration are distinct protected areas. Shared catalogue renderer avoids duplicate category implementations.
3. **Components:** server pages compose domain components; client islands handle overlays, selectors, cart, wishlist and validated forms. Shared semantic fields and buttons.
4. **Database:** PostgreSQL migrations, UUID identities, foreign keys, integer kobo prices, immutable order snapshots, indexed public catalogue queries and own-row RLS.
5. **Authentication:** Supabase cookie SSR, Google PKCE, verified server user and refresh proxy. Missing credentials produce explicit setup states, never fake login.
6. **Authorization:** separate user_roles table; server admin guard on every mutation plus database RLS. No role stored in editable profile metadata.
7. **Catalogue:** data-managed hierarchical categories, audiences, tags, collections, draft/active/archived products, images and configurable variant attribute maps.
8. **Inventory:** variant quantities; locked, atomic database order operation checks active products and decrements inventory. No client price accepted.
9. **Cart:** bounded, validated guest local storage; authenticated cart persistence through owned rows. Merge variant quantities, cap against current availability, report adjustments.
10. **Checkout:** shared Zod schema and React Hook Form; Nigerian delivery fields; server pricing and delivery lookup. Explicit test order mode only; no card fields or paid claims.
11. **Orders:** human-friendly reference plus UUID; independent order/payment/fulfilment states. Guest access via cryptographically random secret, stored hashed; owners via session.
12. **Email:** server-only Mailgun adapter and development capture; transactional outbox separates order commit from delivery failure. HTML escaped and plaintext included.
13. **Images/storage:** locally cached licensed development photography, responsive next/image; Supabase Storage for administrator media, file signatures and dimension validation.
14. **Validation:** shared Zod at client/server boundary and independent database constraints. Strict limits on quantities, text, file size and payloads.
15. **Errors:** useful inline expected errors; generic unexpected errors with redacted structured server logging; deliberate empty/loading/not-found screens.
16. **Tests:** Vitest domain and component behavior; Playwright shopping, negative paths, auth boundaries and mobile; isolated Supabase tests when local services are available.
17. **CI:** frozen lockfile, formatter, lint, typecheck, unit/components, build, browser tests. No production credentials.
18. **Security:** server-only privileged clients, RLS everywhere, same-origin mutations, redirect allowlist, hashed guest tokens, bounded rate limits, safe uploads and audit trails.
19. **Accessibility:** WCAG 2.2 AA target, semantic forms, focus-visible, skip link, labelled icon controls, native focus-managed dialogs and reduced motion.
20. **Performance:** server rendering, paginated catalogue, image sizes, local fonts, priority hero only, indexed queries and no analytics scripts.

## Operating modes

`DATA_MODE=fixture` is an explicit development/preview mode with licensed placeholder imagery and local test orders. It is not a production database substitute. `DATA_MODE=supabase` reads the actual database; connection errors must surface rather than silently fall back to fixtures. Live checkout remains disabled until a future payment phase. External credentials and approved business data are launch dependencies; see OWNER_ACTION_REQUIRED.md.
