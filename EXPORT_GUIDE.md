# 🚀 ORA Studio — Guide d'Export & Déploiement

> Ce guide te permet d'exporter ton projet Figma Make vers ton propre déploiement (Vercel, Netlify, etc.)

---

## 📦 1. EXPORT DU CODE SOURCE

### Dans Figma Make
1. Clique sur "Export" dans le menu
2. Télécharge le fichier ZIP contenant tout le code source
3. Décompresse le ZIP sur ton ordinateur

**Tu obtiendras** :
```
ora-studio/
├── src/
│   ├── app/
│   │   ├── pages/
│   │   └── components/
│   └── styles/
├── supabase/
│   └── functions/
│       └── server/
│           └── index.tsx
├── package.json
├── vite.config.ts
└── ...
```

---

## 🔐 2. VARIABLES D'ENVIRONNEMENT (API Keys)

### Liste complète des secrets configurés dans ton projet

#### **Supabase (Backend principal)**
```bash
SUPABASE_URL=                     # URL de ton projet Supabase
SUPABASE_ANON_KEY=                # Clé publique (anon key)
SUPABASE_SERVICE_ROLE_KEY=        # Clé admin (SECRET - ne JAMAIS exposer au frontend)
SUPABASE_DB_URL=                  # URL de la base de données Postgres
```

#### **AI Text Generation (APIPod)**
```bash
APIPOD_API_KEY=                   # Pour GPT-4o, GPT-5, Claude, Gemini via APIPod
```

#### **AI Image Generation**
```bash
LUMA_API_KEY=                     # Luma Photon (images) + Ray (vidéos)
LEONARDO_API_KEY=                 # Leonardo AI (alternative images)
FAL_API_KEY=                      # FAL.ai (img2img)
RUNWARE_IMAGE_API_KEY=            # Runware (img2img alternatif)
```

#### **AI Video Generation**
```bash
KLING_ACCESS_KEY=                 # Kling AI (vidéos)
KLING_SECRET_KEY=                 # Kling AI secret
HIGGSFIELD_API_KEY=               # Higgsfield (vidéos)
HIGGSFIELD_API_SECRET=            # Higgsfield secret
RUNWARE_VIDEO_API_KEY=            # Runware (vidéos)
```

#### **AI Audio Generation**
```bash
REPLICATE_API_TOKEN=              # Replicate (musicgen, audio)
```

#### **Web Scraping & Intelligence**
```bash
JINA_API_KEY=                     # Jina AI (web scraping + search)
FIRECRAWL_API_KEY=                # Firecrawl (scraping alternatif)
SCRAPINGBEE_API_KEY=              # ScrapingBee (scraping alternatif)
```

#### **Additional AI Providers**
```bash
MISTRAL_API_KEY=                  # Mistral AI (Brand DNA analysis)
OPENAI_API_KEY=                   # OpenAI direct (si utilisé)
ANTHROPIC_API_KEY=                # Anthropic Claude direct
GOOGLE_AI_API_KEY=                # Google Gemini direct
GEMINI_API_KEY=                   # Google Gemini (alias)
```

#### **Admin**
```bash
ADMIN_EMAIL=romainortel@gmail.com # Email admin (crédits illimités)
```

---

## 🏗️ 3. CONFIGURATION SUPABASE

### Créer ton propre projet Supabase

1. **Va sur [supabase.com](https://supabase.com)**
2. **Crée un nouveau projet** → Note les credentials :
   - `SUPABASE_URL` : `https://xxx.supabase.co`
   - `SUPABASE_ANON_KEY` : `eyJhbG...` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` : `eyJhbG...` (**SECRET**)

3. **Active Authentication** :
   - Settings → Authentication → Providers
   - Active Email/Password
   - (Optionnel) Active Google OAuth, GitHub, etc.

4. **Configure Storage** :
   - Storage → New Bucket : `make-cad57f79-images` (private)
   - Policies : RLS activée, accès via service role

---

## 🌐 4. DÉPLOYER L'EDGE FUNCTION (Backend)

### Option A : Supabase CLI (recommandé)

```bash
# 1. Installe Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link ton projet
supabase link --project-ref <ton-project-id>

# 4. Deploy la fonction
supabase functions deploy make-server-cad57f79 --project-ref <ton-project-id>

# 5. Configure les secrets (variables d'env)
supabase secrets set APIPOD_API_KEY=<ta-clé> --project-ref <ton-project-id>
supabase secrets set LUMA_API_KEY=<ta-clé> --project-ref <ton-project-id>
# ... répète pour TOUTES les API keys ci-dessus
```

### Option B : Supabase Dashboard

1. **Dashboard → Edge Functions → New Function**
2. **Nom** : `make-server-cad57f79`
3. **Upload** : `supabase/functions/server/index.tsx`
4. **Settings → Secrets** : Ajoute toutes les variables d'env

---

## 🚀 5. DÉPLOYER LE FRONTEND

### Option 1 : Vercel (le plus simple)

```bash
# 1. Installe Vercel CLI
npm i -g vercel

# 2. Dans ton dossier projet
cd ora-studio

# 3. Deploy
vercel

# 4. Configure les variables d'environnement sur Vercel Dashboard
# Settings → Environment Variables → Ajoute :
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...

# 5. Redeploy
vercel --prod
```

### Option 2 : Netlify

```bash
# 1. Installe Netlify CLI
npm i -g netlify-cli

# 2. Deploy
netlify deploy --prod

# 3. Configure les env vars dans Netlify Dashboard
```

---

## 🌍 6. DOMAINE PERSONNALISÉ

### Sur Vercel

1. **Dashboard → Settings → Domains**
2. **Add Domain** : `ora.studio` (ou ton domaine)
3. **Configure DNS** chez ton registrar (Namecheap, Google Domains, etc.) :
   - Type : `CNAME`
   - Host : `@` ou `www`
   - Value : `cname.vercel-dns.com`

4. **Attends propagation DNS** (1-48h)

### Sur Netlify

1. **Site settings → Domain management**
2. **Add custom domain**
3. Configure DNS avec les nameservers Netlify

---

## ✅ 7. CHECKLIST DE MIGRATION

### Avant le déploiement
- [ ] Export du code source depuis Figma Make
- [ ] Création projet Supabase
- [ ] Récupération de toutes les API keys
- [ ] Configuration des variables d'environnement

### Backend
- [ ] Edge Function déployée sur Supabase
- [ ] Secrets configurés (toutes les API keys)
- [ ] Table `kv_store_cad57f79` créée (automatique)
- [ ] Storage bucket créé (`make-cad57f79-images`)

### Frontend
- [ ] Build local réussi (`npm run build`)
- [ ] Variables d'env configurées (`VITE_SUPABASE_URL`, etc.)
- [ ] Déploiement sur Vercel/Netlify
- [ ] Test de connexion backend → frontend

### Domaine
- [ ] Domaine acheté
- [ ] DNS configuré
- [ ] SSL activé (automatique sur Vercel/Netlify)

---

## 🔧 8. SCRIPTS UTILES

### Build local
```bash
npm install
npm run dev      # Dev server (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
```

### Test backend
```bash
# Test health endpoint
curl https://xxx.supabase.co/functions/v1/make-server-cad57f79/health

# Test avec auth
curl -X POST https://xxx.supabase.co/functions/v1/make-server-cad57f79/generate/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"model":"gpt-4o","prompt":"Hello","_token":"<USER_JWT>"}'
```

---

## 💰 9. COÛTS ESTIMÉS

### Supabase
- **Free tier** : 500 MB DB, 1 GB storage, 2 GB bandwidth/mois
- **Pro** : $25/mois (8 GB DB, 100 GB storage)

### Vercel
- **Hobby** : Gratuit (100 GB bandwidth, builds illimités)
- **Pro** : $20/mois (domaine custom, analytics)

### API Providers
- **APIPod** : Pay-as-you-go (~$0.015/requête GPT-4o)
- **Luma** : ~$0.03/image, ~$0.15/vidéo
- **Leonardo** : ~$0.02/image
- Voir ton usage actuel dans Make pour estimer

---

## 🆘 10. DEBUGGING

### Edge Function logs
```bash
# Supabase CLI
supabase functions logs make-server-cad57f79 --project-ref <id>

# Ou Dashboard → Edge Functions → Logs
```

### Frontend errors
```bash
# Check console browser (F12)
# Vérifier les erreurs CORS
# Vérifier que les URLs pointent vers ta nouvelle Edge Function
```

### Common issues
- **CORS errors** : Vérifie que l'Edge Function inclut les headers CORS
- **401 Unauthorized** : Vérifie `SUPABASE_ANON_KEY` dans frontend env
- **500 Server Error** : Check Edge Function logs pour voir quelle API key manque

---

## 📞 11. RESSOURCES

- **Supabase Docs** : https://supabase.com/docs
- **Vercel Docs** : https://vercel.com/docs
- **Vite Docs** : https://vitejs.dev
- **APIPod Docs** : https://docs.apipod.ai
- **Luma AI Docs** : https://lumalabs.ai/docs

---

## 🎉 Félicitations !

Une fois tout configuré, ton ORA Studio sera :
- ✅ Hébergé sur ton infrastructure
- ✅ Accessible via ton domaine perso (`ora.studio`)
- ✅ Avec contrôle total sur le code et les données
- ✅ Scalable et production-ready

**Note** : Garde ton projet Figma Make comme environnement de dev rapide ! Tu peux toujours y tester de nouvelles features avant de les déployer en prod.
