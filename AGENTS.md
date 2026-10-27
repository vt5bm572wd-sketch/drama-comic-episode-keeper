<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Work-link recognition (`src/lib/drama/link-import.ts`) is pure client-side parsing with an exact-hostname allowlist; why: avoids spoofed domains.
- Online work data/search (`src/lib/drama/hongguo.functions.ts`) is fetched server-side only from the fixed hongguoduanju.com origin, with URLs built from a validated numeric ID or an encoded query, never from user-supplied URLs; parsing lives in pure `hongguo-data.ts`; why: prevents SSRF and keeps the undocumented page format testable, with manual fill as fallback when it changes.
- Stored source URLs are always rebuilt from the validated numeric series ID (on link and on backup import), never kept from user input; why: prevents javascript:/spoofed links being rendered.
- Cover images never go into localStorage as Base64: work.cover holds an https/site URL or a `nina-cover:<key>` ref to a compressed image in IndexedDB (`src/lib/drama/cover-store.ts`, resolved via `useCoverSrc`); legacy data: covers are migrated at startup and backups inline/externalize them; why: iPhone Safari's ~5MB localStorage quota fills after a few covers.

