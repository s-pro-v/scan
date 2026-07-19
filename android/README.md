# SYS.SCANNER — Android APK (bezpieczny WebView)

## Dlaczego komunikat „dla starszego systemu”?

Stary APK miał zbyt niski `targetSdk`. Ten projekt ustawia:

| Parametr     | Wartość              | Znaczenie                               |
| ------------ | -------------------- | --------------------------------------- |
| `minSdk`     | **26** (Android 8.0) | Minimalny system                        |
| `targetSdk`  | **35** (Android 15)  | Spełnia wymagania Play / bezpieczeństwo |
| `compileSdk` | **35**               | Kompilacja pod aktualne API             |

## Bezpieczeństwo (włączone)

- brak HTTP cleartext (`usesCleartextTraffic=false` + `network_security_config`)
- brak backupu danych skanów / numerów (`allowBackup=false`)
- kamera tylko po **runtime permission** + `PermissionRequest` WebView
- assety przez **WebViewAssetLoader** (`https://appassets.androidplatform.net`) — bez `file://`
- Safe Browsing WebView
- ProGuard / R8 w release
- WhatsApp / zewnętrzne linki w aplikacji systemowej (nie w WebView)

## Budowa APK (Android Studio)

1. Zainstaluj [Android Studio](https://developer.android.com/studio) (SDK 35).
2. Otwórz folder `android/` jako projekt.
3. Przed buildem zsynchronizuj pliki WWW:

```bat
cd android
sync-assets.bat
```

4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
   albo w terminalu:

```bat
gradlew.bat assembleRelease
```

5. APK: `android/app/build/outputs/apk/release/app-release.apk`  
   (wymaga podpisania — Studio zaproponuje keystore przy pierwszym release).

### Szybki test (debug)

```bat
sync-assets.bat
gradlew.bat assembleDebug
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`  
(ID: `com.oxy.sysscanner.debug`)

## Instalacja na telefonie

1. Włącz **Opcje deweloperskie → Debugowanie USB** albo skopiuj APK.
2. Przy instalacji na Android 13+ zezwól na źródło (ten komputer / pliki).
3. Przy pierwszym uruchomieniu **zezwól na kamerę**.

## Po 31.08.2026 (Google Play)

Nowe aplikacje w Play będą wymagały `targetSdk 36`. Wtedy w `app/build.gradle.kts` podnieś:

```kotlin
compileSdk = 36
targetSdk = 36
```

## Uwaga

Nie instaluj losowych starych APK z nieznanego źródła. Ten folder `android/` to oficjalny wrapper pod aktualne wymagania bezpieczeństwa.
