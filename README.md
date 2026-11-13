# 📅 Calendrier Famille — Guide d'installation (≈ 20 min, gratuit)

Application web installable (PWA) : un seul code pour iPhone, iPad, Android et PC.
Synchronisation temps réel et mode hors ligne via Firebase (offre gratuite « Spark »).

## 1. Créer le projet Firebase
1. Aller sur https://console.firebase.google.com → **Ajouter un projet** (ex. `calendrier-famille`). Google Analytics : inutile.
2. **Paramètres du projet ⚙️ > Vos applications > Web (</>)** → enregistrer l'app.
3. Copier l'objet `firebaseConfig` affiché dans **config.js**.
4. Dans **config.js**, adapter les prénoms et couleurs de `MEMBERS`.

## 2. Comptes de la famille
1. **Authentication > Commencer > E-mail/Mot de passe** → Activer.
2. Onglet **Utilisateurs > Ajouter un utilisateur** : un compte par personne
   (pas besoin de compte Google, une simple adresse e-mail suffit).

## 3. Base de données
1. **Firestore Database > Créer une base** → mode production, région `europe-west9 (Paris)`.
2. Dans **firestore.rules**, remplacer les adresses e-mail par celles créées à l'étape 2.
   👉 Seules ces adresses pourront voir ou modifier le calendrier.

## 4. Mise en ligne
Prérequis : Node.js installé (https://nodejs.org).
```bash
npm install -g firebase-tools
firebase login
# remplacer VOTRE-PROJET dans .firebaserc par l'ID du projet
firebase deploy
```
L'application est en ligne sur `https://VOTRE-PROJET.web.app`.

## 5. Installer sur chaque appareil
| Appareil | Procédure |
|---|---|
| iPhone / iPad | Safari → bouton **Partager** → **Sur l'écran d'accueil** |
| Android | Chrome → menu ⋮ → **Installer l'application** |
| PC | Edge ou Chrome → icône **Installer** dans la barre d'adresse |

## Utilisation
- **Clic sur un jour** : affiche ses événements ; **2e clic** ou **+** : ajoute un événement.
- **Pastilles de couleur** en haut : filtrer par membre (mémorisé sur l'appareil).
- **Agenda** : liste des 60 prochains jours.
- Balayage gauche/droite sur mobile pour changer de mois.
- Hors connexion : consultation et saisie possibles, synchronisation automatique au retour du réseau.

## Tester en local (optionnel)
```bash
npx serve .        # puis ouvrir http://localhost:3000
```
(Ajouter `localhost` dans Authentication > Paramètres > Domaines autorisés s'il n'y est pas.)

## Limites connues / évolutions possibles
- Supprimer un événement récurrent supprime toute la série.
- Pistes : notifications de rappel (Cloud Messaging), export .ics vers Outlook, pièces jointes.
