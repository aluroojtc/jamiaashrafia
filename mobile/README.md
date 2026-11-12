# Jamia Ashrafia LMS — mobile app (Flutter)

The mobile app of the LMS portal. It signs in with the same accounts and passwords, uses the same server,
database, roles and permissions as the web portal, and opens live classes and public meetings in the native
Jitsi Meet SDK so an Android phone can share its screen (a browser on Android cannot).

Nothing is duplicated on the server: the app calls the portal's existing API (`/api/auth/*`, `/api/store`,
`/api/virtual-class/*`, `/api/public-meetings/*`, `/api/meeting-controls/*`, `/api/notifications`). The only
server change is one public file Android needs for meeting links (`/.well-known/assetlinks.json`, see below).

## What is in the app

| Area | How |
| --- | --- |
| Sign-in, temporary password change, sign-out | Native. The server's session cookie is kept in the phone's keystore; the password is never stored. |
| Roles and permissions | From `/api/auth/me`, exactly as the portal. The dashboard follows the role's data scope: whole institution → admin dashboard (Super Admin included), classes they teach → teacher, own records → student. Menus only list pages the role opens; the server checks every request again. |
| Online classes | Native meeting. Students join, hosts start / enter / end. Attendance is recorded on joining, as on the portal. |
| Public meetings | Native. Start one, copy its link, enter as host, end it (permission `virtual_classes.public_meeting`). Guests join by link without an account. |
| Timetable, attendance, assignments, exams & results, fees, notifications | Native screens (reading). Marking, grading, uploading and editing open the portal's own page inside the app. |
| Everything else (users, roles, admissions, students, teachers, reports, library, setup, recordings ...) | The portal's page inside the app, already signed in with the app's session. |

There is no parent dashboard: the LMS has no parent accounts or parent role yet.

## Run and build

Needs Android 8.0 (API 26) or newer: the Jitsi Meet SDK does not run on older phones.

```
flutter pub get
flutter run                      # on a connected phone
flutter test
flutter build apk --release      # an APK to install by hand
flutter build appbundle --release  # the .aab for Google Play
```

The portal address is `https://lms.jamiaashrafia.asia`. To point a build at another server (e.g. a test
server), set both:

- Dart side: `--dart-define=LMS_BASE_URL=https://test.example.org` (`lib/config.dart`)
- Android link handling: add `lms.host=test.example.org` to `android/gradle.properties`

## Release signing (Google Play)

Package name: `com.jamiaashrafia.lms`.

The upload key is `android/upload-keystore.jks` (alias `upload`); its password is in `android/key.properties`.
Neither file is committed. **Back both up somewhere safe**: every update uploaded to Google Play must be signed
with this key. (If it is ever lost, Play support can register a new upload key, as long as Play App Signing is on.)

```
flutter build appbundle --release
```

gives `build/app/outputs/bundle/release/app-release.aab`. Raise `version:` in `pubspec.yaml` before each upload
(the number after `+` must go up every time).

On another computer, copy the keystore into `android/` and `key.properties.example` to `key.properties`, filled
in. Without `key.properties`, release builds are signed with the debug key and refused by Google Play.

In the Play Console the app must declare its foreground service (type *media projection*, used for screen
sharing in meetings) and why it uses the camera and microphone.

## Meeting links open the app (WhatsApp)

Links the portal gives out — `https://lms.jamiaashrafia.asia/meet/<code>` (public meetings) and
`https://lms.jamiaashrafia.asia/live.html?session=<id>` (classes) — open in the app when it is installed.
Android only does this without asking after it has verified the app against the portal:

1. Find the SHA-256 fingerprint(s) of the certificate the installed app is signed with:
   - Google Play: Play Console → your app → Test and release → Setup → App signing → *App signing key
     certificate* → SHA-256. (Add the *upload key* fingerprint too if you install your own release builds.)
   - A local build: `keytool -list -v -keystore android/upload-keystore.jks -alias upload`
2. On the server, add to `.env` (comma separated for several) and restart (`pm2 restart jamia-lms`):
   `ANDROID_APP_SHA256=AB:CD:...:EF`
3. Check `https://lms.jamiaashrafia.asia/.well-known/assetlinks.json` shows the app and the fingerprint.

Until then the link opens in the browser as before; people can still use "Join a meeting with a link" on the
app's sign-in screen and paste it. `jamiaashrafia://meet/<code>` also opens the app.

## Limits to know

- Host tools that live in the web meeting page are not in the native meeting: changing Meeting Settings during
  a meeting, "one screen share at a time", portal recording (start / stop / save) and "record to my computer".
  The settings saved for the room (chat on/off, renaming) are applied when someone joins from the app, and
  microphone / camera moderation is enforced by the meeting server for everyone. Hosts who need those tools
  should host from the web portal.
- Choosing files to upload from the portal pages shown inside the app is not wired up.
- iOS: the project builds the same app, but screen sharing on iPhone needs a broadcast extension and meeting
  links need Associated Domains, both set up in Xcode on a Mac with the Apple developer team. Not done here.

## Layout

```
lib/config.dart                 portal address
lib/core/api_client.dart        HTTP + session cookie
lib/core/session.dart           who is signed in, permissions, portal (staff / teacher / student)
lib/core/store.dart             the person's LMS records (/api/store)
lib/core/modules.dart           pages and the permissions that open them (mirrors the portal)
lib/core/deep_links.dart        meeting and class links
lib/meeting/meeting_service.dart  native Jitsi: classes, public meetings, attendance
lib/screens/                    sign-in, dashboards, classes, modules, portal pages
```
