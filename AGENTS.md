<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Changelog & aide : à mettre à jour à chaque commit/deploy

**À chaque livraison qui modifie le comportement visible** (commit poussé sur `main` ou déploiement Vercel) :

1. **Changelog (obligatoire)**
   - Va dans `/admin/changelog`, clique **« Synchroniser depuis GitHub »**.
   - L'endpoint `/api/admin/sync-changelog` lit les nouveaux commits via l'API GitHub publique, génère une formulation user-friendly via Claude Haiku, et upsert dans `changelog_entries` (idempotent sur `commit_sha`).
   - Si pas d'accès admin : l'auto-sync n'est pas encore branché côté CI, donc à faire manuellement après chaque push.
   - Format attendu côté user : titre court sans jargon, résumé 1 phrase, catégorie (`feature` / `improvement` / `fix` / `internal`). Les `internal` (refacto, types, build…) sont masqués sur `/changelog`.

2. **Aide (si nécessaire)**
   - Si la modif change ce que voit/fait l'utilisateur (nouveau bouton, nouveau flow, renommage), mets à jour `app/(app)/help/page.tsx` et son client `components/help/HelpClient.tsx`.
   - Pas besoin de toucher l'aide pour : fix de bug invisible, refacto, perf, types, infra.
   - L'aide doit rester orientée tâches (« Comment faire X ») plutôt que catalogue de fonctionnalités.

3. **Vérification rapide**
   - Après push sur `main`, attendre l'auto-deploy Vercel (~45 s), puis :
     - `/changelog` → la nouveauté apparaît (ou clique sync dans `/admin/changelog`)
     - `/help` → l'info pertinente est à jour si applicable
