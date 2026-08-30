# Meal Ledger — Administrator Setup

## Authorized account

The only administrator identity in this release is:

```text
foysal.cyber@gmail.com
```

Both conditions are required:

1. The signed-in Firebase Authentication email must match exactly.
2. Firebase Authentication must report that the email is verified.

The browser hides administrator controls from everyone else, while `firestore.rules` independently enforces access on Firebase servers.

## One-time setup

1. Publish this release to GitHub Pages.
2. Publish `firestore.rules` to Firebase:

   ```bash
   firebase login
   firebase use hostel-meal-fd287
   firebase deploy --only firestore:rules
   ```

3. Create or sign in to the site with `foysal.cyber@gmail.com`.
4. Verify the email using the message sent by Firebase Authentication.
5. Return to the site and sign in again, or open **Settings → Administrator access** and press **Verify admin email**.
6. Open **Admin panel**.

If the panel says permission is denied, first confirm that the latest rules were deployed, then sign out and sign back in so Firebase refreshes the verified-email token.

## What the panel shows

- Registered profile count
- Resident display name and email
- Numeric Room No.
- Approximate active-now count
- Profiles active within the last 24 hours
- Unique represented rooms and missing Room No. records
- Last active time, session counter and meal-action counter
- Search, activity/room filters and CSV export

Activity is approximate rather than a surveillance-grade audit log:

- The app writes a presence heartbeat about every 2 minutes while its browser tab is visible.
- **Active now** means the last heartbeat is no more than 5 minutes old.
- **Active in 24h** means the last heartbeat is no more than 24 hours old.
- Browser sleep, offline use, closed tabs and battery-saving behavior can delay heartbeats.

The administrator can read profile-level monitoring metadata only. Individual month/day meal documents remain private to their owner under the supplied rules.

## Password security

Passwords cannot be viewed in this dashboard. Firebase Authentication deliberately does not expose users' plaintext passwords to client applications or Firestore.

This project therefore:

- never writes passwords to Firestore;
- never renders passwords in administrator UI;
- never exports passwords to CSV; and
- directs users to Firebase's password-reset flow when access recovery is needed.

Do not add a password field to `/users/{uid}`. Doing so would create a serious credential leak.

## Room No. behavior

- Email/password sign-up requires 1–6 numeric digits.
- Google-auth and existing users without a Room No. receive a required profile-completion prompt after sign-in.
- Every user can update Room No. in **Settings → Profile**.
- Security Rules reject nonnumeric Room No. values.

## Changing the administrator later

Change the same email in both places, then redeploy both site and rules:

- `ADMIN_EMAIL` in `app.js`
- `isVerifiedAdmin()` in `firestore.rules`

Keeping only one of these in sync will either hide a valid panel or cause server-side access denial.
