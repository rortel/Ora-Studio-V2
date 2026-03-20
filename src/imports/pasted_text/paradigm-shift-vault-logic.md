Constitution. Tout en découle.
CHANGEMENT DE PARADIGME
Dans la version précédente, le vault était chargé en arrière-plan et utilisé pour une compliance check à la fin. C'est backwards.
Nouvelle logique :
Vault → génère la Story Bible → Story Bible contraint TOUT
(prompts, voiceover, visuels, musique, assemblage)
Le vault n'est pas un filet de sécurité. C'est le moule.
PHASE 0 — VAULT EXTRACTION (automatique, avant le brief)
Avant même que l'utilisateur écrive quoi que ce soit, le vault est déstructuré en contraintes actives.
0.1 — Extraction des contraintes dures
BRAND DNA (extrait du vault) :
├── Identité visuelle
│   ├── Palette primaire : [hex exact]
│   ├── Palette secondaire : [hex exact]
│   ├── Style photographique : [ex: "lumière naturelle, tons chauds, lifestyle"]
│   ├── Fonts used : [ex: "Inter Bold pour titres"]
│   └── Interdits visuels : [ex: "jamais fond blanc pur, jamais concurrent visible"]
├── Ton de voix
│   ├── Adjectifs de marque : [ex: "précis, humain, ambitieux"]
│   ├── Mots interdits : [liste exacte]
│   ├── Formules signature : [ex: "On livre, vous brillez"]
│   └── Niveau de langage : [ex: "pro sans jargon, tutoiement"]
├── Produit(s) concerné(s) [voir 0.2]
└── Règles de compliance
    ├── Secteur interdit : [ex: alcool, armes si marque enfant]
    ├── Références culturelles autorisées : [ex: "cinéma grand public OK, violence NON"]
    └── Mentions légales obligatoires
0.2 — Extraction des produits (critique)
Pour chaque produit sélectionné dans le brief, le vault fournit une fiche produit structurée :
PRODUCT ANCHOR :
├── Nom exact (tel qu'il doit apparaître dans le voiceover)
├── Description visuelle précise (couleur, forme, taille relative)
│   → ex : "camion eTGX, gris anthracite, logo blanc sur portière, remorque haute"
├── USP principale (ce que le produit fait mieux)
├── USP secondaire
├── Moment d'usage canonique (quand/comment il apparaît dans une histoire)
└── Règle d'apparition obligatoire :
    ├── Doit apparaître dans au moins N scènes (défini par vault ou défaut = 2)
    ├── Doit être nommé explicitement dans le voiceover
    └── Ne peut pas être hors focus dans la scène finale
Si le vault est incomplet sur le produit → blocage avec message "Compléter la fiche produit avant de générer".
PHASE 1 — BRIEF (utilisateur, 30 secondes)
1.1 — Inputs standards
Brief texte libre
Produit(s) sélectionné(s) — déjà dans le vault, fiche pré-chargée
Audience cible
URL optionnelle (scrapping auto si hors vault)
1.2 — Inputs Reel Drama
Mood : Epic / Suspense / Comédie / Émotion / Underdog
Référence : "Laisse ORA choisir" ou texte libre
Durée : 15s / 30s / 60s
Scènes : Auto ou 3 / 4 / 5
1.3 — Affichage vault résumé (nouveau)
Avant de cliquer Generate, l'utilisateur voit un résumé :
┌─────────────────────────────────────────┐
│  Brand DNA actif                        │
│  Palette : ████ ████ ████               │
│  Ton : précis · humain · ambitieux      │
│  Produit : eTGX — gris anthracite       │
│  Apparition obligatoire : scènes 2 + 4  │
│  Mots interdits : 12 règles actives     │
└─────────────────────────────────────────┘
L'utilisateur sait exactement avec quoi ORA travaille. Pas de surprise.
PHASE 2 — STORY BIBLE (serveur, ~10 secondes)
Nouveau concept clé. Avant d'écrire une seule scène, le LLM génère une Story Bible — le document de référence qui verrouille tout.
2.1 — Génération de la Story Bible
Le LLM reçoit : brief + vault complet (Brand DNA + Product Anchor) + mood + référence.
Il produit un seul objet :
STORY BIBLE :

1. CONCEPT
   Référence choisie : [titre + justification 1 ligne]
   Pitch : [1 phrase — le film de la marque]
   
2. IDENTITÉ VISUELLE CONSTANTE (copy-paste dans chaque prompt)
   Sujet principal : [description physique exacte et figée]
   Environnement : [description exacte et figée]
   Palette : [hex vault imposée]
   Style ciné : [ex: "anamorphic 2.39:1, warm grade LUT, shallow DOF f/1.8"]
   Éclairage : [ex: "golden hour, backlit, lens flare naturel"]
   → Ces 5 éléments ne changent JAMAIS entre les scènes.

3. ANCRES PRODUIT
   Scène(s) où le produit est au premier plan : [N obligatoires]
   Scène(s) où le produit est nommé : [voiceover exact]
   Scène finale : produit visible + claim de marque obligatoire

4. ARC NARRATIF
   Acte 1 (scènes 1-N) : tension / problème
   Acte 2 (scènes N-M) : irruption du produit comme solution
   Acte 3 (scènes M-fin) : résolution + branding

5. COHÉRENCE ÉMOTIONNELLE
   Émotion par scène : [liste ordonnée]
   Progression : [ex: "curiosité → tension → surprise → satisfaction"]
2.2 — Écriture du scénario (contraint par la Story Bible)
Pour chaque scène, le LLM produit :
SCÈNE N :
├── Titre court
├── Action (2 lignes — cohérente avec l'arc narratif)
├── Voiceover (10-20 mots — validé contre mots interdits)
├── Présence produit : [OUI/NON + type: "premier plan" / "arrière-plan" / "nommé"]
├── Émotion : [depuis la liste de la Story Bible]
├── Durée : Xs
├── Video prompt : 
│   [ANCRES VISUELLES CONSTANTES — copié depuis Story Bible]
│   + [action spécifique à cette scène]
│   + [mouvement caméra]
│   → Format : "Style: {style_ciné}. Setting: {env}. Subject: {sujet_produit}. Action: {action}. Camera: {mouvement}. Lighting: {éclairage}. Color: {palette}."
└── Transition : cut / fade / zoom
Règle dure : si une scène ne contient pas le produit alors que l'arc narratif l'exige → le LLM doit justifier ou être re-prompté automatiquement.
2.3 — Compliance check (vault-driven, pas heuristique)
Validations systématiques :
Chaque voiceover passe contre la liste mots_interdits du vault → regex exact
Nombre d'apparitions produit ≥ seuil vault → comptage dur
La référence culturelle est compatible avec secteur_interdit vault → LLM judge
Le style ciné est cohérent avec style_photographique vault → LLM judge
Score compliance : 0-100, seuil minimum configurable par vault (défaut 85)
PHASE 3 — VALIDATION STORYBOARD (utilisateur, 10 secondes)
Affichage :
┌─────────────────────────────────────────────────────┐
│  PITCH : "Ocean's Eleven, mais c'est une équipe     │
│  logistique qui planifie la livraison parfaite"     │
│  Référence : Ocean's Eleven — Score vault : 94/100  │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│ Sc. 1    │ Sc. 2    │ Sc. 3    │ Sc. 4    │ Sc. 5   │
│ Le Plan  │ L'Équipe │ Le Twist │ eTGX ●   │ Payoff  │
│ 4s       │ 6s       │ 6s       │ 8s       │ 6s      │
│ curiosité│ tension  │ surprise │ produit  │ satisf. │
└──────────┴──────────┴──────────┴──────────┴─────────┘
  ● = apparition produit obligatoire
Actions : Valider / Changer référence / Éditer scène inline / Changer mood → Produce
PHASE 4 — GÉNÉRATION VISUELLE (serveur, ~60-180s)
4.1 — Keyframes (cohérence garantie par la Story Bible)
Chaque image prompt = ancres constantes (Story Bible) + delta scène
image_prompt = f"""
{story_bible.style_cine}. 
{story_bible.environment}. 
{story_bible.subject_description}. 
Action: {scene.action_visuelle}.
Color palette: {vault.palette_primaire}.
"""
Même palette, même sujet, même style → cohérence maximale sans post-processing.
4.2 — Clips vidéo (Luma ray-flash-2)
Input par scène : keyframe + video prompt (même format contraint)
Toutes les scènes en parallèle. Polling toutes les 5s.
4.3 — Gestion d'erreur par scène
Si un clip échoue :
Retry x2 automatique
Si toujours échec → scène marquée "à régénérer" en Phase 6
Pipeline continue avec les autres scènes (pas de blocage global)
PHASE 5 — ASSEMBLAGE via Creatomate + Gemini Audio
5.1 — Musique via Gemini
Le brief musical est généré depuis la Story Bible :
MUSIC BRIEF (généré par LLM depuis mood + arc narratif) :
├── Genre : [ex: "orchestral cinématique"]
├── Tempo : [ex: "lent au début, montée progressive, drop à scène 4"]
├── Instruments : [ex: "cordes, cuivres, percussions épiques"]
├── Durée exacte : [= durée totale du reel]
├── Structure : [ex: "intro 4s, build 16s, climax 8s, resolution 2s"]
└── Mood mots-clés : [ex: "tension, momentum, triumphant"]
Ce brief est envoyé à Gemini + son éditeur audio pour générer une piste originale, libre de droits, durée exacte, synchronisée sur l'arc narratif.
5.2 — TTS Voiceover (avant assemblage)
Le voiceover de chaque scène est généré avant l'assemblage :
Provider : ElevenLabs ou OpenAI TTS
Durée audio mesurée → si elle dépasse la durée de scène, le clip est allongé via Creatomate (time-stretch) ou le voiceover est coupé net
5.3 — Assemblage Creatomate
Template Creatomate généré dynamiquement depuis le scénario :
{
  "output_format": "mp4",
  "width": 1080,
  "height": 1920,
  "frame_rate": 30,
  "elements": [
    // Pour chaque scène :
    {
      "type": "video",
      "source": "{clip_url}",
      "duration": "{scene.duration}",
      "transition": { "type": "{scene.transition}", "duration": 0.3 }
    },
    // Voiceover overlay
    {
      "type": "audio",
      "source": "{tts_url}",
      "volume": 1.0
    },
    // Musique Gemini en fond
    {
      "type": "audio", 
      "source": "{gemini_music_url}",
      "volume": 0.3  // voiceover prioritaire à -3dB
    },
    // Caption TikTok style
    {
      "type": "text",
      "text": "{scene.voiceover}",
      "font_family": "{vault.font}",
      "color": "{vault.palette_primaire}",
      "animations": [{"type": "typewriter"}]
    }
  ],
  // Outro branding (dernière scène)
  "outro": {
    "logo": "{vault.logo_url}",
    "duration": 1.5,
    "background_color": "{vault.palette_secondaire}"
  }
}
Tout ce qui touche aux couleurs, fonts, logo vient du vault. Zéro valeur hardcodée.
5.4 — Export
MP4 final → Supabase Storage (bucket privé, signed URL 24h)
Clips individuels stockés séparément → nécessaire pour régénération en Phase 6.
PHASE 6 — REVIEW ET LIVRAISON
Player vidéo + timeline cliquable par scène.
Actions :
Download MP4
Régénérer une scène → re-génère uniquement le clip, re-assemble via Creatomate (clips intermédiaires disponibles)
Éditer voiceover → re-génère TTS, re-mix Creatomate
Sauvegarder en campagne
Metadata auto-générée (vault-driven) :
Caption optimisée pour le réseau cible (ton de voix du vault)
Hashtags (liste seed depuis vault + génération contextuelle)
Alt-text accessibilité
RÉCAPITULATIF DES CHANGEMENTS CLÉS
Sujet
Avant
Après
Vault
Chargé en fond, check à la fin
Moule de tout — Phase 0 structurée
Produit
Peut disparaître des scènes
Ancre obligatoire, comptage dur, blocage si absent
Cohérence visuelle
Ancres dans les prompts (espoir)
Story Bible verrouillée, copy-paste dans chaque prompt
Cohérence narrative
Scènes indépendantes
Arc narratif défini avant toute scène
Musique
"libre de droits selon mood"
Gemini génère une piste originale sur brief structuré
Assemblage
FFmpeg ou "peut-être Creatomate"
Creatomate, décidé, template dynamique vault-driven
TTS timing
Phase 5, après les clips
Avant les clips, durée mesurée, clips ajustés
Couleurs/fonts assemblage
Potentiellement hardcodées
100% depuis le vault, zéro valeur en dur
La Story Bible est le pivot. C'est elle qui transforme le vault de "règles à respecter" en "ADN injecté dans chaque pixel