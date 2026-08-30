# Release 1.2.0 — Rooms & Secure Monitoring

## Added

- Required 1–6 digit Room No. on email/password account creation
- Required room-completion prompt for Google-auth and existing users without a room
- Editable Room No. in profile settings
- Verified administrator access for `foysal.cyber@gmail.com`
- Live registered-profile directory with email and room data
- Active-now (5 minutes) and active-in-24-hours estimates
- Session and meal-action counters
- Search plus active, 24h, inactive and missing-room filters
- Safe CSV user-directory export
- Desktop and five-item mobile administrator navigation
- Dedicated administrator deployment/security guide

## Security

- Firestore rules, not UI visibility, authorize the exact verified administrator account.
- Administrator access is read-only and limited to top-level safe profile/activity metadata.
- Individual month/day meal documents remain owner-only.
- Profile fields are allowlisted; Room No. must be numeric.
- Activity timestamps must use Firestore server time and counters can advance only one step per write.
- Passwords stay exclusively in Firebase Authentication and are never stored, displayed or exported.

## Presence definitions

- Browser heartbeat: approximately every 2 minutes while the tab is visible
- Active now: last heartbeat within 5 minutes
- Active in 24h: last heartbeat within 24 hours

These values are approximate because sleeping devices, offline use, closed tabs and browser throttling can delay a heartbeat.
