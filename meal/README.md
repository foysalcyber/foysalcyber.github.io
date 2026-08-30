# Meal Ledger

A responsive, Firebase-powered hostel meal tracker designed for static hosting on GitHub Pages. The interface is fully English and follows a dark, technical visual language inspired by the provided Foysal Cyber pages, with an optional light theme.

## What is included

- Email/password sign-up, sign-in, password reset and optional Google sign-in
- Strict per-user Firestore isolation
- Three on/off meal slots for every valid day of the selected month
- Automatic 28/29/30/31-day calendar generation
- Locked meal rules:
  - Breakfast: **0.5 meal every day**
  - Friday lunch: **2 meals**; every other lunch: **1 meal**
  - Tuesday dinner: **2 meals**
  - Sunday dinner: **1.5 meals**
  - Every other dinner: **1 meal**
- Locked rate: **1 meal = Tk 52**
- Monthly advance, cost, remaining balance and due amount
- Quick-fill actions, day filters, cumulative spending chart and weekday insights
- CSV statement and JSON backup export
- Dark, light and system themes
- Browser-only demo mode, so the UI remains testable without Firebase/network access
- Responsive desktop, tablet and mobile layouts
- Calculation unit tests

## Calculation integrity

Billing does not add decimal meal values with floating-point arithmetic. Internally:

- `1 half-unit = 0.5 meal`
- `1 half-unit = 2,600 paisa = Tk 26`
- All meal totals are integers in half-units
- All money is integers in paisa
- Final cost is `total half-units × 2,600 paisa`

For example, 53.5 meals is 107 half-units, so the exact bill is `107 × Tk 26 = Tk 2,782`.

## Project files

```text
meal-ledger/
├── index.html                 # Application shell and all UI views
├── styles.css                 # Responsive dark/light design system
├── app.js                     # Auth, Firestore, UI and export logic
├── core.js                    # Pure calendar and billing engine
├── firestore.rules           # Per-user, field-allowlisted rules
├── firebase.json              # Firebase CLI rule deployment config
├── manifest.webmanifest
├── assets/
│   ├── fonts/                 # Local Syne and DM Mono font files
│   └── icons/favicon.svg
├── tests/core.test.mjs
└── package.json
```

## 1. Test locally

A web server is required because the app uses JavaScript modules.

```bash
cd meal-ledger
npm test
npm run dev
```

Then open `http://localhost:4173`. Select **Explore demo** to inspect every screen without creating an account. Demo data is stored only in browser `localStorage`.

## 2. Firebase Console setup

The supplied Firebase web configuration is already in `app.js` for project `hostel-meal-fd287`. A Firebase web API key is a public project identifier, not a database password; data security depends on Authentication and the included Firestore rules.

### Authentication

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Select `hostel-meal-fd287`.
3. Go to **Build → Authentication → Get started**.
4. Under **Sign-in method**, enable **Email/Password**.
5. Optional: enable **Google** if the Google button should work.
6. Under **Authentication → Settings → Authorized domains**, add:
   - `foysalcyber.github.io`
   - Any custom domain that will serve the app
   - `localhost` for local testing (normally present by default)

No user needs to be added manually. The **Create account** form creates a Firebase Authentication user, and the app creates that user's Firestore profile automatically.

### Cloud Firestore

1. Go to **Build → Firestore Database**.
2. Create the database in **production mode**.
3. Choose the region closest to the hostel/users.
4. Deploy `firestore.rules` before using real accounts.

Install and authenticate the Firebase CLI, then run:

```bash
npm install -g firebase-tools
firebase login
cd meal-ledger
firebase use hostel-meal-fd287
firebase deploy --only firestore:rules
```

If `firebase use` asks for project setup, run `firebase use --add` and select `hostel-meal-fd287`.

## 3. Firestore structure

```text
users/{uid}
  displayName
  email
  createdAt
  updatedAt

users/{uid}/months/{YYYY-MM}
  monthKey
  advancePaisa
  mealRatePaisa       # must be exactly 5200
  createdAt
  updatedAt

users/{uid}/months/{YYYY-MM}/days/{YYYY-MM-DD}
  dateKey
  breakfast           # optional boolean; missing means false
  lunch               # optional boolean; missing means false
  dinner              # optional boolean; missing means false
  updatedAt
```

The rules enforce that:

- A signed-in user can access only paths under their own UID.
- Unexpected fields are rejected.
- Meal fields must be booleans.
- Advance money must be a non-negative integer number of paisa.
- The meal rate must remain exactly `5200` paisa.
- Identity fields, month IDs, date IDs and timestamps are validated.

The UI also ignores malformed/out-of-month legacy day IDs, and the billing engine iterates only real Gregorian dates generated for the selected month.

## 4. Deploy to GitHub Pages

### Put it in a subfolder of the existing portfolio

Copy the contents of this folder into a repository folder such as:

```text
foysalcyber.github.io/meal-ledger/
```

Commit and push:

```bash
git add meal-ledger
git commit -m "Add Firebase Meal Ledger"
git push
```

If GitHub Pages already serves the repository, the app will be available at:

```text
https://foysalcyber.github.io/meal-ledger/
```

All local paths are relative, so the app works both at a repository root and inside a subfolder. The included `.nojekyll` file prevents unnecessary Jekyll processing when this folder is deployed as a standalone Pages artifact.

### Important authorized-domain note

Email/password auth works after that provider is enabled. Google popup auth additionally requires the deployed hostname (`foysalcyber.github.io` or the custom domain) in Firebase Authentication's authorized-domain list.

## Configuration note

The provided `measurementId` was split across two lines. It has been normalized to:

```text
G-7WK2JBXNB6
```

Analytics is not loaded and is not required for this app, so this value does not affect meal tracking.

## Keyboard shortcut

- **Ctrl/Cmd + E** — export the selected month as CSV
- **Escape** — close a modal, account menu or mobile navigation
