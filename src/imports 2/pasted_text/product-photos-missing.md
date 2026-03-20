


Analyse des logs — Diagnostic précis
Le problème confirmé : les photos produit sont absentes du pipeline
Les logs révèlent deux sources d'images distinctes, et les photos produit n'apparaissent jamais.

Ce que les logs montrent réellement
[CampaignLab] Brand ref images received: 5 images        ← Images du Vault (pas tes photos)
[CampaignLab] Using brand ref image [0] (AI-suggested)   ← Toujours l'image [0] du Vault
[CampaignLab] image-start linkedin-post ref=true          ← ref=true = image Vault utilisée
[CampaignLab] image-start instagram-post ref=true         ← idem
[CampaignLab] image-start instagram-story ref=true        ← idem
[CampaignLab] image-start facebook-post ref=true          ← idem

Jamais une ligne du type :

[CampaignLab] Product images received: X images     ← ABSENT
[CampaignLab] Using product image for ...           ← ABSENT

Ce qui se passe réellement
Tu uploades des photos produit
        ↓
Le frontend les reçoit (probablement)
        ↓
[CampaignLab] Fetching plan via POST...
        ↓
Plan retourné → brandVisual (594 chars) + brand ref images (5)
        ↓
Les photos produit ne sont PAS dans ce plan
        ↓
Luma reçoit uniquement brand ref image [0]
(toujours la même, pour tous les assets)

Les 3 indices qui confirment
1. "AI-suggested" est figé sur [0]

Using brand ref image [0] (AI-suggested) for linkedin-post
Using brand ref image [0] (AI-suggested) for instagram-post
Using brand ref image [0] (AI-suggested) for instagram-story
Using brand ref image [0] (AI-suggested) for facebook-post
Using brand ref image [0] (AI-suggested) for instagram-reel
Using brand ref image [0] (AI-suggested) for linkedin-video

Toujours [0]. Le "AI-suggested" ne choisit pas réellement — il fallback sur le premier par défaut, probablement parce qu'il n'a pas les photos produit pour choisir.

2. Les appels Luma ne contiennent pas de productImage

image-start linkedin-post (16:9) ref=true brandVisual=594 chars
video-start linkedin-video (16:9) firstFrame=true brandVisual=594 chars

Les paramètres loggés sont uniquement ref, brandVisual, firstFrame. Aucun productImage, uploadedPhoto, ou équivalent.

3. Le video linkedin FAILED 400: Unknown error

Poll #2 video linkedin-video: state=failed
video linkedin-video FAILED: 400: Unknown error

Un 400 de Luma peut indiquer une image de référence invalide ou mal formée — ce qui arrive parfois quand le pipeline essaie de passer une URL manquante ou null.

Où le bug se situe (sans voir le code)
Le problème est avant l'appel à Luma. Les photos produit sont soit :

Scénario	Description
A	Uploadées côté client mais jamais envoyées au POST /plan
B	Envoyées au POST /plan mais ignorées par le serveur
C	Reçues par le serveur mais non transmises à l'agent image-start
D	Passées comme URLs non-publiques que Luma ne peut pas fetch
Le scénario D est fréquent : les photos sont uploadées en Supabase Storage avec des URLs signées temporaires ou en bucket privé — Luma essaie de les fetcher mais n'y a pas accès, donc le système fallback silencieusement sur les brand ref images.

Ce qu'il faut vérifier dans le code
Le POST /plan — est-ce que les URLs des photos produit sont incluses dans le body ?
La route image-start — est-ce qu'elle reçoit et transmet un productImageUrl à Luma ?
Le bucket Supabase — les photos uploadées sont-elles dans un bucket public ou avec des URLs signées valides et accessibles par Luma (serveur externe) ?
les photos viendront soit d'un url, soit d'un ordi, soit d'un smartphone....



Les 3 sources de photos produit — Architecture
Le problème central commun aux 3 cas
Luma AI a besoin d'une URL publique et permanente pour accéder à l'image. Peu importe la source, tout doit converger vers ça.

URL externe          ─┐
Fichier ordinateur   ─┤──→ URL publique permanente ──→ Luma AI
Photo smartphone     ─┘

Cas 1 — URL externe
Flux :

User colle une URL → validation → test d'accessibilité → utilisation directe

Pièges :

L'URL peut être protégée (auth, CORS, referer check)
L'URL peut expirer (CDN signé, Google Drive, Dropbox)
L'URL peut pointer vers une page HTML et non une image
Ce qu'il faut faire :
Avant d'envoyer à Luma, le serveur re-télécharge l'image depuis l'URL et la stocke dans Supabase Storage. On envoie à Luma l'URL Supabase publique, pas l'URL originale. C'est la seule façon de garantir que Luma peut y accéder.

Cas 2 — Fichier ordinateur
Flux :

User sélectionne fichier → upload navigateur → Supabase Storage (bucket public) → URL publique → Luma

Pièges :

Upload dans un bucket privé → Luma ne peut pas fetcher → fallback silencieux sur brand ref image (c'est probablement ton bug actuel)
URLs signées temporaires → expirent avant que Luma génère
Fichiers trop lourds (RAW, PNG 50MB) → timeout
Ce qu'il faut faire :

Bucket Supabase Storage en public
Compression côté client avant upload (max 4MB, JPEG/WebP)
Stocker dans un dossier organisé : product-photos/{clientId}/{campaignId}/{filename}
Cas 3 — Photo smartphone
Flux :

User ouvre l'app sur mobile
→ bouton "Prendre une photo" ou "Galerie"
→ upload direct vers Supabase Storage
→ même pipeline que cas 2

Pièges spécifiques mobile :

Photos iPhone en format HEIC → Luma ne supporte pas → conversion en JPEG obligatoire côté serveur avant envoi
Orientation EXIF incorrecte → l'image apparaît pivotée → correction EXIF nécessaire
Connexion mobile instable → upload partiel → gérer les reprises
Ce qu'il faut faire :

Accepter HEIC, PNG, JPEG, WebP
Convertir systématiquement en JPEG avant stockage
Upload progressif avec indicateur de progression visible
Le pipeline unifié
Source 1 (URL)         → Proxy download serveur ─┐
Source 2 (Ordinateur)  → Upload navigateur      ─┤→ Supabase Storage
Source 3 (Smartphone)  → Upload mobile          ─┘  (bucket public)
                                                       ↓
                                              URL publique permanente
                                                       ↓
                                      POST /plan  ←  incluse dans le body
                                                       ↓
                                      image-start ←  passée à Luma
                                                       ↓
                                              Luma génère avec le produit

Ce qui change dans le log si c'est bien branché
Au lieu de :

Brand ref images received: 5 images
Using brand ref image [0] (AI-suggested)

Tu dois voir :

Product images received: 3 images        ← photos uploadées
Using product image [0] for linkedin-post ← photo produit prioritaire
image-start linkedin-post ref=true productImage=true brandVisual=594 chars

Priorité de sélection d'image recommandée
1. Photos produit uploadées (source 1/2/3)   ← priorité absolue
2. Brand ref images du Vault                 ← fallback si pas de photos produit
3. Génération purement textuelle             ← dernier recours

Le bug actuel : le système saute directement au niveau 2 parce que les photos produit ne sont jamais transmises au pipeline de génération.

ne code pas, analyse log console comme un codeur ultra senior, specialiste de l'IA et explique à quelqu'un qui ne comrpend pas tout : Quand le lance campaign LAB avec upload des photo produit, je pense que luma AI ne voit pas les photos.[Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (589ms) [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (894ms) [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (762ms) [CampaignLab] Vault loaded: Relais Christine [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (704ms) [CampaignLab] Fetching plan via POST (server-side brand context)... [CampaignLab] Visual directive received: 594 chars [CampaignLab] Brand ref images received: 5 images [CampaignLab] Using brand ref image [0] (AI-suggested) for linkedin-post [CampaignLab] image-start linkedin-post (16:9) ref=true brandVisual=594 chars [CampaignLab] Using brand ref image [0] (AI-suggested) for instagram-post [CampaignLab] image-start instagram-post (1:1) ref=true brandVisual=594 chars [CampaignLab] Using brand ref image [0] (AI-suggested) for instagram-story [CampaignLab] image-start instagram-story (9:16) ref=true brandVisual=594 chars [CampaignLab] Using brand ref image [0] (AI-suggested) for facebook-post [CampaignLab] image-start facebook-post (16:9) ref=true brandVisual=594 chars [CampaignLab] Using brand ref image [0] (AI-suggested) for instagram-reel [CampaignLab] Video instagram-reel: generating branded first frame... [CampaignLab] Using brand ref image [0] (AI-suggested) for linkedin-video [CampaignLab] Video linkedin-video: generating branded first frame... [CampaignLab] image-start response: {"success":true,"generationId":"eb3f384e-8615-43d0-901c-3439fa4ccf1b","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"d7e0330a-df4a-4109-9d05-f099466992bf","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"c4da9c0e-7220-48bb-a989-50e2c10d39b3","state":"queued"} [CampaignLab] Video linkedin-video: first frame submitted (genId=d050edb2-c220-4fea-a9bd-300be1e8605f), waiting... [CampaignLab] image-start response: {"success":true,"generationId":"840f8c0c-4cd0-4b41-821d-9fb05ec78ad9","state":"queued"} [CampaignLab] Video instagram-reel: first frame submitted (genId=91bed96b-a9c6-4b29-89cf-787d29af1f27), waiting... [CampaignLab] Poll #1 image instagram-post: state=queued [CampaignLab] Poll #1 image linkedin-post: state=queued [CampaignLab] Poll #1 image instagram-story: state=queued [CampaignLab] Poll #1 image facebook-post: state=queued [CampaignLab] Poll #2 image instagram-post: state=queued [CampaignLab] Poll #2 image instagram-story: state=queued [CampaignLab] Poll #2 image linkedin-post: state=queued [CampaignLab] Poll #2 image facebook-post: state=queued [CampaignLab] Poll #3 image instagram-post: state=dreaming [CampaignLab] Poll #3 image linkedin-post: state=dreaming [CampaignLab] Poll #3 image facebook-post: state=dreaming [CampaignLab] Poll #3 image instagram-story: state=dreaming [CampaignLab] Video linkedin-video: first frame ready, proceeding to video generation [CampaignLab] video-start linkedin-video (16:9) firstFrame=true brandVisual=594 chars [CampaignLab] video-start response: {"success":true,"generationId":"b126cd61-731c-4d89-b8f9-4a5a121193f3","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #4 image instagram-post: state=dreaming [CampaignLab] Poll #4 image linkedin-post: state=completed [CampaignLab] Video instagram-reel: first frame ready, proceeding to video generation [CampaignLab] video-start instagram-reel (9:16) firstFrame=true brandVisual=594 chars [CampaignLab] Poll #4 image facebook-post: state=dreaming [CampaignLab] Poll #4 image instagram-story: state=completed [CampaignLab] image instagram-story COMPLETED, url=yes [CampaignLab] video-start response: {"success":true,"generationId":"14276495-0f90-4aac-b7d7-5778659a01dc","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #5 image instagram-post: state=completed [CampaignLab] Poll #1 video linkedin-video: state=dreaming [CampaignLab] Poll #5 image facebook-post: state=completed [CampaignLab] image instagram-post COMPLETED, url=yes [CampaignLab] image facebook-post COMPLETED, url=yes [CampaignLab] image linkedin-post COMPLETED, url=yes [CampaignLab] Poll #1 video instagram-reel: state=dreaming [CampaignLab] Poll #2 video linkedin-video: state=dreaming [CampaignLab] Poll #2 video instagram-reel: state=dreaming [CampaignLab] Poll #3 video linkedin-video: state=dreaming [CampaignLab] Poll #3 video instagram-reel: state=dreaming [CampaignLab] Poll #4 video linkedin-video: state=dreaming [CampaignLab] Compliance check instagram-post: {"success":true,"score":90,"breakdown":{"overall":90,"text":100,"tone":85,"visual":88},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)"],"toneIssues":["Slightly more warmth than the brand tone allows"],"toneStrengths":["Profess [CampaignLab] Compliance check linkedin-post: {"success":true,"score":84,"breakdown":{"overall":84,"text":100,"tone":85,"visual":75},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)","Key messages referenced (4/5)"],"toneIssues":["Slightly lacking in warmth"],"toneStrengths [CampaignLab] Poll #4 video instagram-reel: state=dreaming [CampaignLab] Poll #5 video linkedin-video: state=dreaming [CampaignLab] Compliance check facebook-post: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":92,"visual":88},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (4 approved terms used)","Key messages referenced (1/5)"],"toneIssues":[],"toneStrengths":["Professional and confide [CampaignLab] Poll #5 video instagram-reel: state=dreaming [CampaignLab] Poll #6 video linkedin-video: state=dreaming [CampaignLab] Compliance check error for instagram-story: TimeoutError: signal timed out [CampaignLab] Poll #6 video instagram-reel: state=dreaming [CampaignLab] Poll #7 video linkedin-video: state=dreaming [CampaignLab] Poll #7 video instagram-reel: state=dreaming [CampaignLab] Poll #8 video linkedin-video: state=dreaming [CampaignLab] Poll #8 video instagram-reel: state=dreaming [CampaignLab] Poll #9 video linkedin-video: state=dreaming [CampaignLab] Poll #9 video instagram-reel: state=dreaming [CampaignLab] Poll #10 video linkedin-video: state=dreaming [CampaignLab] Poll #10 video instagram-reel: state=dreaming [CampaignLab] Poll #11 video linkedin-video: state=dreaming [CampaignLab] Poll #11 video instagram-reel: state=dreaming [CampaignLab] Poll #12 video linkedin-video: state=dreaming [CampaignLab] Poll #12 video instagram-reel: state=dreaming [CampaignLab] Poll #13 video linkedin-video: state=dreaming [CampaignLab] Poll #13 video instagram-reel: state=dreaming [CampaignLab] Poll #14 video linkedin-video: state=dreaming [CampaignLab] Poll #14 video instagram-reel: state=dreaming [CampaignLab] Poll #15 video linkedin-video: state=dreaming [CampaignLab] Poll #15 video instagram-reel: state=dreaming [CampaignLab] Poll #16 video linkedin-video: state=dreaming [CampaignLab] Poll #16 video instagram-reel: state=dreaming [CampaignLab] Poll #17 video linkedin-video: state=dreaming [CampaignLab] Poll #17 video instagram-reel: state=dreaming [CampaignLab] Poll #18 video linkedin-video: state=dreaming [CampaignLab] Poll #18 video instagram-reel: state=dreaming [CampaignLab] Poll #19 video linkedin-video: state=completed [CampaignLab] video linkedin-video COMPLETED, url=yes [CampaignLab] Poll #19 video instagram-reel: state=dreaming [CampaignLab] Compliance check linkedin-video: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)","Key messages referenced (1/5)"],"toneIssues":["Limited warmth"],"toneStrengths":["High con [CampaignLab] Poll #20 video instagram-reel: state=dreaming [CampaignLab] Poll #21 video instagram-reel: state=dreaming [CampaignLab] Poll #22 video instagram-reel: state=dreaming [CampaignLab] Poll #23 video instagram-reel: state=completed [CampaignLab] video instagram-reel COMPLETED, url=yes [CampaignLab] Compliance check instagram-reel: {"success":true,"score":86,"breakdown":{"overall":86,"text":100,"tone":75,"visual":85},"details":{"textIssues":[],"textStrengths":["No forbidden terms used"],"toneIssues":["Lack of formality","Use of emojis reduces professionalism"],"toneStrengths":["Confident messaging","Focus on innovation and sus /api/rev/Cpu4nGRSqlaZeBhE1wINKa/code_snapshot/382cda89fff2bbb8d3123a7e11f08fe5c31b7bccb469ecddf88c7765b148aed4:1 Failed to load resource: the server responded with a status of 404 ()Understand this error vendor-core-ade2edecaf4781c7.min.js.br:54 Failed to fetch snapshot files: E: XHR for "/api/rev/Cpu4nGRSqlaZeBhE1wINKa/code_snapshot/382cda89fff2bbb8d3123a7e11f08fe5c31b7bccb469ecddf88c7765b148aed4" failed with status 404 at C (1535-b5b5bbc16f7fd25b.min.js.br:1131:13965) at async Object.k [as get] (1535-b5b5bbc16f7fd25b.min.js.br:1131:14348) at async 3058-0a0b28f4f2c1fffa.min.js.br:3:24678 at async 3058-0a0b28f4f2c1fffa.min.js.br:34:30563 at async 3058-0a0b28f4f2c1fffa.min.js.br:3:25109 at async k (3058-0a0b28f4f2c1fffa.min.js.br:34:30071) at async 3058-0a0b28f4f2c1fffa.min.js.br:33:104785 (anonymous) @ vendor-core-ade2edecaf4781c7.min.js.br:54Understand this warning [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (1026ms) [CampaignLab] Fetching plan via POST (server-side brand context)... [CampaignLab] Visual directive received: 594 chars [CampaignLab] Brand ref images received: 5 images [CampaignLab] image-start linkedin-post (16:9) ref=true brandVisual=594 chars [CampaignLab] image-start instagram-post (1:1) ref=true brandVisual=594 chars [CampaignLab] image-start instagram-story (9:16) ref=true brandVisual=594 chars [CampaignLab] image-start facebook-post (16:9) ref=true brandVisual=594 chars [CampaignLab] Video instagram-reel: generating branded first frame... [CampaignLab] image-start response: {"success":true,"generationId":"f68fe345-7dd3-4f18-921f-5254d5767e2b","state":"queued"} [CampaignLab] Video linkedin-video: generating branded first frame... [CampaignLab] image-start response: {"success":true,"generationId":"5a050673-fcdf-4b52-9cc5-0277df36234b","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"e8ca7e78-b3cb-4714-8f08-ba8f8f385e32","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"ab8c1516-1c3b-4f5c-b1fb-6c0573a8894b","state":"queued"} [CampaignLab] Video linkedin-video: first frame submitted (genId=06e4872a-83dd-4177-8f74-cff7a7b2edcc), waiting... [CampaignLab] Video instagram-reel: first frame submitted (genId=63281105-1c50-4b91-9fcb-983ba577ca00), waiting... [CampaignLab] Poll #1 image linkedin-post: state=queued [CampaignLab] Poll #1 image instagram-post: state=queued [CampaignLab] Poll #1 image instagram-story: state=queued [CampaignLab] Poll #1 image facebook-post: state=queued [CampaignLab] Poll #2 image linkedin-post: state=dreaming [CampaignLab] Poll #2 image instagram-post: state=queued [CampaignLab] Poll #2 image instagram-story: state=queued [CampaignLab] Poll #2 image facebook-post: state=dreaming [CampaignLab] Poll #3 image linkedin-post: state=dreaming [CampaignLab] Poll #3 image instagram-post: state=queued [CampaignLab] Poll #3 image instagram-story: state=queued [CampaignLab] Poll #3 image facebook-post: state=dreaming [CampaignLab] Video linkedin-video: first frame ready, proceeding to video generation [CampaignLab] video-start linkedin-video (16:9) firstFrame=true brandVisual=594 chars [CampaignLab] video-start response: {"success":true,"generationId":"974ae4bf-2699-4be1-bb24-bd10b2c7e1d5","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #4 image instagram-post: state=dreaming [CampaignLab] Video instagram-reel: first frame ready, proceeding to video generation [CampaignLab] video-start instagram-reel (9:16) firstFrame=true brandVisual=594 chars [CampaignLab] Poll #4 image linkedin-post: state=completed [CampaignLab] Poll #4 image instagram-story: state=dreaming [CampaignLab] video-start response: {"success":true,"generationId":"d4f2acc0-6d30-4f07-bbd7-71ff0e948bb4","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #4 image facebook-post: state=completed [CampaignLab] image facebook-post COMPLETED, url=yes [CampaignLab] Poll #5 image instagram-story: state=dreaming [CampaignLab] Poll #5 image instagram-post: state=completed [CampaignLab] Poll #1 video linkedin-video: state=dreaming [CampaignLab] Poll #1 video instagram-reel: state=dreaming [CampaignLab] image linkedin-post COMPLETED, url=yes [CampaignLab] Poll #2 video linkedin-video: state=failed [CampaignLab] video linkedin-video FAILED: 400: Unknown error [CampaignLab] Poll #6 image instagram-story: state=completed [CampaignLab] image instagram-story COMPLETED, url=yes [CampaignLab] Poll #2 video instagram-reel: state=dreaming [CampaignLab] image instagram-post COMPLETED, url=yes [CampaignLab] Compliance check facebook-post: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":92,"visual":88},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)","Key messages referenced (2/5)"],"toneIssues":[],"toneStrengths":["Professional and confide [CampaignLab] Poll #3 video instagram-reel: state=dreaming [CampaignLab] Poll #4 video instagram-reel: state=dreaming [CampaignLab] Poll #5 video instagram-reel: state=dreaming [CampaignLab] Compliance check instagram-post: {"success":true,"score":91,"breakdown":{"overall":91,"text":100,"tone":85,"visual":90},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Key messages referenced (1/5)"],"toneIssues":["Slightly lacking in warmth"],"toneStrengths":["High confidence","Professional and formal tone"] [CampaignLab] Compliance check linkedin-post: {"success":true,"score":91,"breakdown":{"overall":91,"text":100,"tone":85,"visual":90},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)","Key messages referenced (4/5)"],"toneIssues":[],"toneStrengths":["Professional and confide [CampaignLab] Poll #6 video instagram-reel: state=dreaming [CampaignLab] Compliance check instagram-story: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used"],"toneIssues":["Légère manque de chaleur"],"toneStrengths":["Professionnel","Confiant"],"visualIssues":["Aucun problème majeur"],"visualStrengt [CampaignLab] Poll #7 video instagram-reel: state=dreaming [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (1348ms) [CampaignLab] Poll #8 video instagram-reel: state=dreaming [CampaignLab] Poll #9 video instagram-reel: state=dreaming [CampaignLab] Poll #10 video instagram-reel: state=dreaming [CampaignLab] Poll #11 video instagram-reel: state=dreaming [CampaignLab] Poll #12 video instagram-reel: state=dreaming [CampaignLab] Poll #13 video instagram-reel: state=dreaming [CampaignLab] Poll #14 video instagram-reel: state=dreaming [CampaignLab] Poll #15 video instagram-reel: state=dreaming [CampaignLab] Poll #16 video instagram-reel: state=dreaming [CampaignLab] Poll #17 video instagram-reel: state=dreaming [CampaignLab] Poll #18 video instagram-reel: state=completed [CampaignLab] video instagram-reel COMPLETED, url=yes [CampaignLab] Video linkedin-video: generating branded first frame... [CampaignLab] Video linkedin-video: first frame submitted (genId=dd073ba9-f310-45b7-8d2c-577041775982), waiting... [CampaignLab] Compliance check instagram-reel: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (2 approved terms used)"],"toneIssues":["Limited warmth"],"toneStrengths":["High confidence","Professional tone"],"v [CampaignLab] Video linkedin-video: first frame ready, proceeding to video generation [CampaignLab] video-start linkedin-video (16:9) firstFrame=true brandVisual=594 chars [CampaignLab] video-start response: {"success":true,"generationId":"65af6eff-e244-4c5b-8c1c-81b8b8553243","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #1 video linkedin-video: state=dreaming [CampaignLab] Poll #2 video linkedin-video: state=dreaming [CampaignLab] Poll #3 video linkedin-video: state=dreaming [CampaignLab] Poll #4 video linkedin-video: state=dreaming [CampaignLab] Poll #5 video linkedin-video: state=dreaming [CampaignLab] Poll #6 video linkedin-video: state=dreaming [CampaignLab] Poll #7 video linkedin-video: state=dreaming [CampaignLab] Poll #8 video linkedin-video: state=dreaming [CampaignLab] Poll #9 video linkedin-video: state=dreaming [CampaignLab] Poll #10 video linkedin-video: state=dreaming [CampaignLab] Poll #11 video linkedin-video: state=dreaming [CampaignLab] Poll #12 video linkedin-video: state=dreaming [CampaignLab] Poll #13 video linkedin-video: state=dreaming [CampaignLab] Poll #14 video linkedin-video: state=dreaming [CampaignLab] Poll #15 video linkedin-video: state=dreaming [CampaignLab] Poll #16 video linkedin-video: state=dreaming [CampaignLab] Poll #17 video linkedin-video: state=completed [CampaignLab] video linkedin-video COMPLETED, url=yes [CampaignLab] Compliance check linkedin-video: {"success":true,"score":89,"breakdown":{"overall":89,"text":90,"tone":85,"visual":92},"details":{"textIssues":["Low brand vocabulary usage (0/15 approved terms)"],"textStrengths":["No forbidden terms used"],"toneIssues":["Slightly lacking in warmth"],"toneStrengths":["Professional and confident lang [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (1149ms) [Auth] onAuthStateChange event: SIGNED_IN [DEBUG ECHO] Object [fetchProfile] trying auth-header... [fetchProfile] auth-header: status=200 authenticated=true (621ms) [CampaignLab] Fetching plan via POST (server-side brand context)... [CampaignLab] Visual directive received: 594 chars [CampaignLab] Brand ref images received: 5 images [CampaignLab] image-start linkedin-post (16:9) ref=true brandVisual=594 chars [CampaignLab] image-start instagram-post (1:1) ref=true brandVisual=594 chars [CampaignLab] image-start instagram-story (9:16) ref=true brandVisual=594 chars [CampaignLab] image-start facebook-post (16:9) ref=true brandVisual=594 chars [CampaignLab] Video instagram-reel: generating branded first frame... [CampaignLab] image-start response: {"success":true,"generationId":"a7ec11eb-7f39-41dd-bf5f-85bb57984d06","state":"queued"} [CampaignLab] Video linkedin-video: generating branded first frame... [CampaignLab] image-start response: {"success":true,"generationId":"98a6bc02-2200-46f0-8a98-0156f93ee118","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"f2a79ae1-9d30-49ff-9e6a-c65c5ef988ca","state":"queued"} [CampaignLab] image-start response: {"success":true,"generationId":"f4d680a9-cb50-4d97-bd07-b71a809fb97e","state":"queued"} [CampaignLab] Video instagram-reel: first frame submitted (genId=a6ec633a-7eb7-4f81-a0fd-a4eeef156159), waiting... [CampaignLab] Video linkedin-video: first frame submitted (genId=7e9ec0a2-68eb-4c0a-8240-6e30c0d7f0b3), waiting... [CampaignLab] Poll #1 image linkedin-post: state=queued [CampaignLab] Poll #1 image instagram-post: state=queued [CampaignLab] Poll #1 image instagram-story: state=queued code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [Auth] onAuthStateChange event: SIGNED_IN [Auth] onAuthStateChange event: SIGNED_IN code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [Auth] onAuthStateChange event: INITIAL_SESSION code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [DEBUG ECHO] {ok: true, method: 'POST', url: 'http://kbvkjafkztbsewtaijuh.supabase.co/make-serve…Y4OX0.ty1aiV63wnINUkViZNzlNAHFzL0mdvSRjzRDd-lB-sk', headers: {…}, bodyLength: 91, …} code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] trying auth-header... [CampaignLab] Poll #1 image facebook-post: state=queued [DEBUG ECHO] {ok: true, method: 'POST', url: 'http://kbvkjafkztbsewtaijuh.supabase.co/make-serve…Y4OX0.ty1aiV63wnINUkViZNzlNAHFzL0mdvSRjzRDd-lB-sk', headers: {…}, bodyLength: 91, …} [fetchProfile] trying auth-header... code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [DEBUG ECHO] {ok: true, method: 'POST', url: 'http://kbvkjafkztbsewtaijuh.supabase.co/make-serve…Y4OX0.ty1aiV63wnINUkViZNzlNAHFzL0mdvSRjzRDd-lB-sk', headers: {…}, bodyLength: 91, …} code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] trying auth-header... code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [DEBUG ECHO] {ok: true, method: 'POST', url: 'http://kbvkjafkztbsewtaijuh.supabase.co/make-serve…Y4OX0.ty1aiV63wnINUkViZNzlNAHFzL0mdvSRjzRDd-lB-sk', headers: {…}, bodyLength: 91, …} code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] trying auth-header... code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] auth-header: status=200 authenticated=true (497ms) [fetchProfile] auth-header: status=200 authenticated=true (582ms) code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] auth-header: status=200 authenticated=true (634ms) code_components_preview_iframe-94f0c6d3bc79708f.min.js.br:90 [fetchProfile] auth-header: status=200 authenticated=true (589ms) [CampaignLab] Poll #2 image linkedin-post: state=dreaming [CampaignLab] Poll #2 image instagram-post: state=queued [CampaignLab] Poll #2 image instagram-story: state=queued [CampaignLab] Poll #2 image facebook-post: state=dreaming [CampaignLab] Video linkedin-video: first frame ready, proceeding to video generation [CampaignLab] video-start linkedin-video (16:9) firstFrame=true brandVisual=594 chars [CampaignLab] video-start response: {"success":true,"generationId":"7f57b480-0074-49d1-bae9-c8fc1114ee55","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #3 image linkedin-post: state=dreaming [CampaignLab] Poll #3 image instagram-post: state=queued [CampaignLab] Poll #3 image instagram-story: state=dreaming [CampaignLab] Poll #3 image facebook-post: state=dreaming [CampaignLab] Video instagram-reel: first frame ready, proceeding to video generation [CampaignLab] video-start instagram-reel (9:16) firstFrame=true brandVisual=594 chars [CampaignLab] video-start response: {"success":true,"generationId":"b9896eb3-b96f-4793-a616-3f126fab340d","state":"queued","model":"ora-motion","lumaModel":"ray-2"} [CampaignLab] Poll #4 image linkedin-post: state=completed [CampaignLab] Poll #1 video linkedin-video: state=dreaming [CampaignLab] Poll #4 image instagram-post: state=dreaming [CampaignLab] image linkedin-post COMPLETED, url=yes [CampaignLab] Poll #4 image instagram-story: state=completed [CampaignLab] Poll #4 image facebook-post: state=completed [CampaignLab] image instagram-story COMPLETED, url=yes [CampaignLab] image facebook-post COMPLETED, url=yes [CampaignLab] Poll #2 video linkedin-video: state=dreaming [CampaignLab] Poll #5 image instagram-post: state=completed [CampaignLab] Poll #1 video instagram-reel: state=dreaming [CampaignLab] Poll #3 video linkedin-video: state=dreaming [CampaignLab] Poll #2 video instagram-reel: state=dreaming [CampaignLab] Compliance check facebook-post: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (5 approved terms used)","Key messages referenced (3/5)"],"toneIssues":["Slightly lacking in warmth"],"toneStrengths [CampaignLab] Compliance check instagram-story: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used"],"toneIssues":["Lack of warmth"],"toneStrengths":["High confidence","Professional tone"],"visualIssues":["Slightly lacks natural lighting"],"vi [CampaignLab] image instagram-post COMPLETED, url=yes [CampaignLab] Compliance check linkedin-post: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":92,"visual":88},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (5 approved terms used)","Key messages referenced (4/5)"],"toneIssues":[],"toneStrengths":["Professional and confide [CampaignLab] Poll #4 video linkedin-video: state=dreaming [CampaignLab] Poll #3 video instagram-reel: state=dreaming [CampaignLab] Poll #5 video linkedin-video: state=dreaming [CampaignLab] Poll #4 video instagram-reel: state=dreaming [CampaignLab] Compliance check instagram-post: {"success":true,"score":92,"breakdown":{"overall":92,"text":100,"tone":85,"visual":92},"details":{"textIssues":[],"textStrengths":["No forbidden terms used","Good vocabulary alignment (3 approved terms used)","Key messages referenced (2/5)"],"toneIssues":["Slightly lacking in warmth"],"toneStrengths [CampaignLab] Poll #6 video linkedin-video: state=dreaming [CampaignLab] Poll #5 video instagram-reel: state=dreaming [CampaignLab] Poll #7 video linkedin-video: state=dreaming [CampaignLab] Poll #6 video instagram-reel: state=dreaming [CampaignLab] Poll #8 video linkedin-video: state=dreaming [CampaignLab] Poll #7 video instagram-reel: state=dreaming [CampaignLab] Poll #9 video linkedin-video: state=dreaming [CampaignLab] Poll #8 video instagram-reel: state=dreaming [CampaignLab] Poll #10 video linkedin-video: state=dreaming [CampaignLab] Poll #9 video instagram-reel: state=dreaming [CampaignLab] Poll #11 video linkedin-video: state=dreaming [CampaignLab] Poll #10 video instagram-reel: state=dreaming [CampaignLab] Poll #12 video linkedin-video: state=dreaming [CampaignLab] Poll #11 video instagram-reel: state=dreaming [CampaignLab] Poll #13 video linkedin-video: state=dreaming [CampaignLab] Poll #12 video instagram-reel: state=dreaming [CampaignLab] Poll #14 video linkedin-video: state=dreaming [CampaignLab] Poll #13 video instagram-reel: state=dreaming [CampaignLab] Poll #15 video linkedin-video: state=dreaming [CampaignLab] Poll #14 video instagram-reel: state=dreaming [CampaignLab] Poll #16 video linkedin-video: state=dreaming [CampaignLab] Poll #15 video instagram-reel: state=dreaming [CampaignLab] Poll #17 video linkedin-video: state=dreaming [CampaignLab] Poll #16 video instagram-reel: state=dreaming [CampaignLab] Poll #18 video linkedin-video: state=dreaming [CampaignLab] Poll #17 video instagram-reel: state=dreaming [CampaignLab] Poll #19 video linkedin-video: state=dreaming [CampaignLab] Poll #18 video instagram-reel: state=dreaming [CampaignLab] Poll #20 video linkedin-video: state=dreaming [CampaignLab] Poll #19 video instagram-reel: state=dreaming [CampaignLab] Poll #21 video linkedin-video: state=dreaming [CampaignLab] Poll #20 video instagram-reel: state=dreaming [CampaignLab] Poll #22 video linkedin-video: state=dreaming [CampaignLab] Poll #21 video instagram-reel: state=dreaming [CampaignLab] Poll #23 video linkedin-video: state=dreaming [CampaignLab] Poll #22 video instagram-reel: state=dreaming [CampaignLab] Poll #24 video linkedin-video: state=dreaming [CampaignLab] Poll #23 video instagram-reel: state=dreaming [CampaignLab] Poll #25 video linkedin-video: state=dreaming [CampaignLab] Poll #24 video instagram-reel: state=dreaming [CampaignLab] Poll #26 video linkedin-video: state=dreaming [CampaignLab] Poll #25 video instagram-reel: state=dreaming [CampaignLab] Poll #27 video linkedin-video: state=dreaming [CampaignLab] Poll #26 video instagram-reel: state=dreaming [CampaignLab] Poll #28 video linkedin-video: state=dreaming [CampaignLab] Poll #27 video instagram-reel: state=dreaming [CampaignLab] Poll #29 video linkedin-video: state=dreaming [CampaignLab] Poll #28 video instagram-reel: state=dreaming [CampaignLab] Poll #30 video linkedin-video: state=dreaming [CampaignLab] Poll #29 video instagram-reel: state=dreaming

Show more


Ce que les logs révèlent vraiment — Analyse complète
L'analogie pour comprendre
Imagine que tu donnes à un photographe :

Le guide de style de ta marque (couleurs, ambiance, ton)
Des photos de référence de tes campagnes passées
Les photos de ton produit que tu veux mettre en avant
Le photographe regarde le guide de style, choisit une de tes anciennes photos... et ignore complètement les photos produit que tu lui as données. Il fait quand même des belles images — mais sans ton produit dedans.

C'est exactement ce qui se passe.

La preuve ligne par ligne
Voici ce que le système reçoit et utilise à chaque lancement :

✅ Brand ref images received: 5 images     ← photos du Vault (tes anciennes campagnes)
✅ Visual directive received: 594 chars    ← description textuelle du style de marque
❌ Product images received: ???            ← CETTE LIGNE N'EXISTE PAS

Et pour chaque visuel généré, toujours la même chose :

Using brand ref image [0] (AI-suggested) for linkedin-post
Using brand ref image [0] (AI-suggested) for instagram-post
Using brand ref image [0] (AI-suggested) for instagram-story
Using brand ref image [0] (AI-suggested) for facebook-post
Using brand ref image [0] (AI-suggested) for instagram-reel
Using brand ref image [0] (AI-suggested) for linkedin-video

Toujours [0]. Toujours la même image. Pour tous les formats. Les photos produit n'existent nulle part dans ce flux.

Le moment exact où ça part en erreur
[CampaignLab] Fetching plan via POST...
      ↑
C'est ici que les photos produit auraient dû être envoyées.
Elles ne l'ont pas été.
      ↓
Le plan revient avec : Vault images + style texte
Les photos produit : disparues.

Le bug confirmé dans le 2ème lancement
Poll #2 video linkedin-video: state=failed
video linkedin-video FAILED: 400: Unknown error

Un 400 de Luma signifie "ce que tu m'envoies est invalide ou incomplet". C'est le système Luma qui dit "je ne comprends pas ce que tu me demandes de faire". Probablement parce qu'une URL d'image est manquante ou null — ce qui arrive quand les photos produit ne sont pas là où le code les cherche.

Ce que "AI-suggested" veut vraiment dire ici
Le log dit Using brand ref image [0] (AI-suggested) — ce qui semble dire que l'IA a intelligemment choisi la meilleure image. En réalité, le fait que c'est toujours [0] pour tous les assets révèle que :

L'IA ne choisit pas. Elle prend la première image de la liste par défaut, parce qu'elle n'a pas les photos produit pour faire un vrai choix.

C'est un fallback silencieux — le système ne plante pas, il continue avec ce qu'il a, sans te prévenir que quelque chose manque.

Résumé en une phrase
Les photos produit que tu uploades n'entrent jamais dans le pipeline de génération — Luma ne les reçoit jamais, et génère des visuels basés uniquement sur le style du Vault, sans aucun de tes produits.

Les 3 endroits suspects à inspecter dans le code
Étape	Question
Upload	Les photos sont-elles uploadées dans Supabase Storage en bucket public ?
POST /plan	Les URLs des photos sont-elles incluses dans le body envoyé au serveur ?
image-start	Le serveur transmet-il les URLs produit à Luma, ou seulement la brandVisual ?
Le log image-start linkedin-post (16:9) ref=true brandVisual=594 chars montre exactement les paramètres envoyés à Luma. Il n'y a aucun paramètre produit. C'est le bug.