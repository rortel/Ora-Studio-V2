# ORA — Design Updates: Pro & Fun

> Direction: Maintenir l'énergie "Vivid Creative AMPLIFIED" (typo massive, bento grids, couleurs fluo) tout en ajoutant des micro-interactions et une palette affinée pour un équilibre **pro et fun**.

---

## 🎨 Palette Affinée

### Couleurs enrichies avec variants light/dark

Chaque couleur fluo possède maintenant 3 nuances pour plus de flexibilité :

```css
/* Lime */
--ora-lime: #C8FF00;
--ora-lime-light: #E5FF80;
--ora-lime-dark: #9ACC00;

/* Coral */
--ora-coral: #FF6B6B;
--ora-coral-light: #FF9999;
--ora-coral-dark: #FF4444;

/* Blue */
--ora-blue: #5B5BFF;
--ora-blue-light: #8F8FFF;
--ora-blue-dark: #3D3DCC;

/* + Peach, Mint, Pink, Yellow avec variants */
```

### Neutrals pour sections pro

```css
--ora-neutral-50: #FAFAFA;
--ora-neutral-100: #F5F5F5;
--ora-neutral-200: #EBEBEB;
--ora-neutral-300: #D4D4D4;
```

---

## ✨ Micro-interactions

### Variables CSS

```css
/* Transitions */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);

/* Transforms */
--hover-lift: translateY(-2px);
--hover-scale: scale(1.02);
--active-scale: scale(0.98);

/* Glow effects */
--glow-lime: 0 0 20px rgba(200, 255, 0, 0.4), 0 0 40px rgba(200, 255, 0, 0.2);
--glow-coral: 0 0 20px rgba(255, 107, 107, 0.4), 0 0 40px rgba(255, 107, 107, 0.2);
--glow-blue: 0 0 20px rgba(91, 91, 255, 0.4), 0 0 40px rgba(91, 91, 255, 0.2);
--glow-mint: 0 0 20px rgba(0, 229, 160, 0.4), 0 0 40px rgba(0, 229, 160, 0.2);
```

### Classes utilitaires

```css
.ora-hover-lift:hover { transform: var(--hover-lift); }
.ora-hover-scale:hover { transform: var(--hover-scale); }
.ora-hover-glow-lime:hover { box-shadow: var(--glow-lime); }
/* + coral, blue, mint variants */
```

### Animations keyframes

```css
@keyframes ora-pulse-glow {
  0%, 100% { 
    box-shadow: 0 0 10px rgba(200, 255, 0, 0.2);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 30px rgba(200, 255, 0, 0.4);
    transform: scale(1.05);
  }
}

@keyframes ora-spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## 🧩 Composants mis à jour

### Hero.tsx
- **BentoCard** : `whileHover={{ scale: 1.03, y: -4 }}` + `brightness-105` sur l'image
- **Tags** : `whileHover={{ scale: 1.1 }}` avec `backdrop-blur-sm`
- **Play button vidéo** : `whileHover={{ scale: 1.15 }}`
- **CTA principal** : `boxShadow` au repos + icône Zap animée `whileHover={{ rotate: 15, scale: 1.2 }}`

### ProductShowcase.tsx (Arena Mode)
- **Model cards** : `whileHover={{ backgroundColor, scale: 1.02 }}` quand done
- **Dot indicateur** : `whileHover={{ scale: 1.2, boxShadow: glow }}`

### Pricing.tsx
- **Cards plan** : `whileHover={{ scale: 1.03, y: -8, boxShadow }}` différencié par plan
- **Badge POPULAR** : `whileHover={{ scale: 1.1 }}`
- **Features list** : `whileHover={{ x: 4 }}` sur chaque item
- **CTA button** : ArrowRight animé `group-hover:translate-x-1`
- **Credit packs** : `whileHover={{ scale: 1.05, y: -4 }}`
- **Icône Zap** : `whileHover={{ rotate: 15, scale: 1.2 }}`

### Navbar.tsx
- **Logo** : `whileHover={{ scale: 1.15, rotate: 5 }}` + spring animation
- **Texte ORA** : `whileHover={{ letterSpacing: "0.05em" }}`
- **Nav links** : wrappés dans `motion.div` avec `whileHover={{ scale: 1.05 }}`

### SocialProof.tsx (marquee)
- **Model items** : `whileHover={{ scale: 1.15, y: -2 }}`
- **Dot** : `whileHover={{ scale: 1.5, boxShadow: colored glow }}`

### FAQ.tsx
- **Questions** : `whileHover={{ x: 4 }}` sur le bouton entier
- **Icon +/−** : `whileHover={{ scale: 1.1, rotate }}` + `animate={{ rotate: isOpen ? 180 : 0 }}`
- **Réponse** : `initial={{ y: -10 }}` pour effet de descente fluide

### Footer.tsx
- **Logo** : `whileHover={{ scale: 1.05 }}`
- **Links** : `whileHover={{ x: 3 }}`
- **Social icons** : `whileHover={{ scale: 1.1, color: brandColor }}`

### CTASection.tsx
- **ArrowRight** : animation loop `animate={{ x: [0, 3, 0] }}` + hover effect
- **View pricing button** : `whileHover={{ scale: 1.05 }}`

---

## 🎯 Hiérarchie pro/fun

### Sections professionnelles
- **ProductShowcase (Arena)** : fond noir, interface précise, hover subtils
- **Pricing** : cards structurées, plan Pro highlight avec glow lime
- **FAQ** : design épuré, animations douces

### Sections fun
- **Hero** : bento grid massif, typo 12rem, couleurs fluo dominantes
- **SocialProof** : marquee scrolling rapide, hover ludiques
- **CTASection** : fond lime gradient, orbs animés, typo géante

---

## 🚀 Performance

- **Spring animations** : `type: "spring", stiffness: 300` pour réactivité
- **Cubic-bezier** : `cubic-bezier(0.4, 0, 0.2, 1)` pour transitions CSS
- **GPU-accelerated** : `transform` et `opacity` uniquement pour smooth 60fps

---

## 📐 Règles de design

### Conservées (Vivid Creative)
✅ Typo massive (jusqu'à 12rem)  
✅ Palette fluo chaude (lime, coral, blue, peach, mint)  
✅ Bento grids plein écran  
✅ Max-width 1600px  
✅ Borders 2-3px solid  
✅ Rounded-3xl (1rem base radius)

### Ajoutées (Pro & Fun)
✨ Nuances de couleurs (light/dark variants)  
✨ Micro-interactions au hover (scale, lift, glow)  
✨ Animations subtiles (spring physics)  
✨ Hiérarchie visuelle renforcée (sections pro vs fun)  
✨ Effets de profondeur (box-shadow colorées)

---

**Résultat** : ORA conserve son énergie maximale tout en gagnant en sophistication grâce aux micro-interactions et à la palette affinée. L'expérience reste **vivid et bold**, avec une couche de **polish professionnel** qui rend chaque interaction satisfaisante.
