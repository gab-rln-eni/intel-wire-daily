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

- External pipeline endpoints (publier-synthese, lister-abonnes) are TanStack server routes under /api/public/, guarded by the x-publication-secret header; why: the stack forbids new edge functions and /api/public bypasses site auth.
- Account deletion is a requireSupabaseAuth server function calling auth.admin.deleteUser; why: the admin key must stay server-side.
