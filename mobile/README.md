# IT PARK ACADEMY — Flutter app

Native Flutter client for the IT PARK ACADEMY LMS. It talks to the same Django
REST API as the web app; there is no WebView and no mock data.

## Requirements

- Flutter 3.35+ (Dart 3.13+)
- Android SDK with an emulator or a physical device
- The backend running locally or a deployed HTTPS API

## Run locally

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

`10.0.2.2` is the Android emulator's alias for the host machine.

For a physical device on the same Wi-Fi network, either use the machine's LAN IP
(cleartext is blocked by the network security config unless you add the domain) or
forward the port and use localhost:

```bash
adb reverse tcp:8000 tcp:8000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000
```

The only hosts allowed to use cleartext HTTP are `10.0.2.2`, `127.0.0.1` and
`localhost` (see `android/app/src/main/res/xml/network_security_config.xml`).
Everything else must be HTTPS.

## Features

- Email/password login and registration against `/api/auth/*`
- Automatic access-token refresh and 401 retry; the refresh token is persisted
  locally and the session is restored on launch
- Catalog with search and category filters
- Course detail with sections, lesson locks, free previews and a checkout sheet
  driven by `/api/payments/methods/` and `/api/payments/checkout/`
- Video lesson player with progress saving, resume position, next/previous lesson
- Quizzes with a server-scored attempt; a failed attempt restarts the quiz
- My learning list with real progress from the API
- Notifications with unread count and mark-as-read
- Profile, email verification resend, language (uz/ru) and dark/light/system theme

Uzbek is the default language; Russian is available from the profile screen. Theme
and language persist locally and sync to the user profile when authenticated.

## Release build

Release builds must use an HTTPS API:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://example.com
```

or an App Bundle for Google Play:

```bash
flutter build appbundle --release --dart-define=API_BASE_URL=https://example.com
```

### Signing

The Gradle config loads `android/key.properties` when it exists. Without it a
release build is signed with the debug key and **must not be published**.

1. Create an upload keystore:

```bash
keytool -genkeypair -v \
  -keystore ~/itpark-upload.jks \
  -alias itpark \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `mobile/android/key.properties` (never commit it):

```properties
storePassword=your-store-password
keyPassword=your-key-password
keyAlias=itpark
storeFile=/home/you/itpark-upload.jks
```

`storeFile` may be absolute or relative to `mobile/android/app`. Keep the keystore
and `key.properties` backed up outside the repository; losing them prevents app
updates on Google Play.

3. Build and verify the signature:

```bash
flutter build appbundle --release --dart-define=API_BASE_URL=https://example.com
jarsigner -verify -verbose -certs build/app/outputs/bundle/release/app-release.aab
```

## Configuration

| Setting | Where |
| --- | --- |
| API base URL | `--dart-define=API_BASE_URL=...` (default `http://10.0.2.2:8000`) |
| Application ID | `android/app/build.gradle.kts` (`uz.itpark.itpark_academy`) |
| Version | `pubspec.yaml` (`version: 1.0.0+1`) |
| Cleartext hosts | `android/app/src/main/res/xml/network_security_config.xml` |
| Signing | `android/key.properties` + upload keystore |

## Security notes

- The access token is kept in memory only.
- The refresh token is stored with `shared_preferences`, which is app-private but
  not hardware-backed. For higher-assurance deployments, replace it with
  `flutter_secure_storage` (Android Keystore) and re-test token refresh.
- Android backup is disabled so app data is not copied to cloud backups.
- All non-local traffic must use HTTPS.

## Testing and analysis

```bash
flutter analyze
flutter test
```

The repository CI should run both before building a release artifact.
