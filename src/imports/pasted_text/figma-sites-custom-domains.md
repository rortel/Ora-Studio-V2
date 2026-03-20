Figma Learn
Lancez-vous
Documentation produit
Administration
Cours, didacticiels, projets
Aide

⌘
K
S'inscrire

Figma Sites
Prévisualiser et publier un site
Gérer un domaine personnalisé pour votre site
Figma Sites a été lancé en version bêta ouverte à l'occasion de Config 2025. Il est actuellement disponible sur tous les forfaits payants, avec une expérience limitée du forfait de base qui sera bientôt disponible. En savoir plus sur ce qui est inclus dans la version bêta.

Qui peut utiliser cette fonctionnalité

Disponible pour tous les forfaits payants

Requiert un accès éditeur au fichier

Par défaut, Figma héberge les sites publiés sur un sous-domaine figma.site généré de manière aléatoire. Dans le cadre d'un forfait payant, vous pouvez également rendre votre site accessible sur un domaine personnalisé que vous possédez.

Combien de domaines personnalisés pouvez-vous avoir pendant la période bêta ?
Les domaines personnalisés sont gratuits jusqu'à la fin de l'année 2025. Les forfaits Organisation et Entreprise permettent de configurer autant de domaines personnalisés que nécessaire, tandis que les forfaits Professionnel peuvent configurer 10 domaines personnalisés. Les limites des domaines personnalisés sont susceptibles d'être modifiées après 2025.

Forfait

Nombre de domaines personnalisés

Professionnel

10

Organisation

Illimité

Enterprise

Illimité

Associer un domaine personnalisé à votre site


Avant d'ajouter un domaine personnalisé à Figma Sites, vous devez acheter un domaine auprès d'un bureau d'enregistrement et mettre à jour ses paramètres.

Voici le processus :

À partir d’un fichier de sites, cliquez sur  Paramètres dans la barre de navigation à gauche.
Dans la section Site, cliquez sur  Domaines.
Cliquez sur Ajouter un domaine connecté.
Entrez votre domaine. Vous devrez ajouter www. ou un autre sous-domaine au début.
Connectez-vous à votre bureau d'enregistrement de domaine.
Localisez les paramètres DNS, souvent situés sous Gestion de domaine ou Paramètres avancés.
Ajoutez l'enregistrement TXT ou CNAME fourni par Figma à vos paramètres DNS.
Retournez à la page Domaines dans Figma et cliquez sur  Actualiser.
Dépanner la connexion au domaine
Il existe différentes raisons pour lesquelles vous pouvez rencontrer des difficultés pour connecter votre domaine :

Retards de propagation DNS : les modifications DNS peuvent prendre du temps à se propager sur Internet. Si vous pensez que vous rencontrez ce problème, nous vous recommandons de patienter et de vérifier plus tard.
Types ou valeurs d'enregistrements incorrects : assurez-vous que les valeurs fournies correspondent exactement à ce qui est requis. Même une petite faute de frappe peut interrompre le processus. Figma affichera une icône d'erreur  si un ou les deux enregistrements ne peuvent pas être vérifiés.
Paramètres DNS conflictuels : vérifiez la présence de doublons ou de données conflictuelles dans vos paramètres DNS, par exemple, plusieurs enregistrements CNAME pour le même sous-domaine.
En attente de certificats SSL : Figma provisionne automatiquement des certificats SSL pour les domaines personnalisés, ce qui garantit un accès sécurisé via HTTPS. La délivrance de ces certificats peut parfois prendre un peu plus de temps que prévu.
Déconnecter un domaine personnalisé de votre site
Vous pouvez déconnecter votre domaine personnalisé à tout moment. Votre site restera accessible sur le web public avec le sous-domaine figma.site généré automatiquement.

À partir d’un fichier de sites, cliquez sur  Paramètres dans la barre de navigation à gauche.
Dans la section Site, cliquez sur Domains.
Cliquez sur le menu  More (Plus).
Sélectionnez Remove connected domain (Supprimer le domaine associé).
Conseil : pour supprimer complètement votre site du Web, vous devez annuler sa publication.

Foire aux questions
Figma prend-il en charge les domaines apex ?
Un domaine apex (également appelé domaine racine ou domaine nu) est le domaine de plus haut niveau sans préfixe de sous-domaine. Par exemple, https://example.com est le domaine principal, tandis que https://www.example.com est un sous-domaine.

Figma ne prend actuellement pas en charge les domaines apex, mais cela sera bientôt disponible. En attendant, nous vous recommandons de rediriger un domaine apex vers son sous-domaine www chez votre fournisseur de domaine.

Un site peut-il avoir plus d'un domaine personnalisé ?
Aujourd'hui, un site ne peut utiliser qu'un seul domaine personnalisé à la fois.

Figma prend-il en charge les domaines génériques ?
Un domaine générique utilise un astérisque (*) pour faire correspondre n'importe quel sous-domaine d'un domaine donné. Par exemple, *.example.com couvrira les requêtes pour blog.example.com, shop.example.com, ou tout autre sous-domaine. Figma ne prend actuellement pas en charge les domaines génériques ; chaque fichier de site ne peut être associé qu'à un seul sous-domaine.

Cet article vous a-t-il été utile ?
Oui
Non
In this article
Associer un domaine personnalisé à votre site
Déconnecter un domaine personnalisé de votre site
Foire aux questions
4 min

Français
Cas d'utilisation
Design UI
Design UX
Prototypage
Design graphique
Maquettage conceptuel
Réflexion
Modèles
Design à distance
Explorer
Fonctionnalités de design
Fonctionnalités de prototypage
Fonctionnalités des systèmes de design
Fonctionnalités de collaboration
FigJam
Tarification
Entreprise
Étudiants et enseignants
Clients
Sécurité
Intégrations
Contact
Ressources
Blog
Meilleures pratiques
Soutien
Développeurs
Apprendre le design
Téléchargements
Nouveautés
Sorties
Recrutement
À propos
Agences partenaires
Confidentialité
Statut

