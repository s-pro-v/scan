# SYS.SCANNER — Android APK (bezpieczny WebView)

## Play Protect: „dla starszej wersji Androida”

Ten komunikat dotyczy **starego APK** (niski `targetSdk`). Ten projekt ustawia:

| Parametr     | Wartość              | Znaczenie                               |
| ------------ | -------------------- | --------------------------------------- |
| `minSdk`     | **26** (Android 8.0) | Minimalny system                        |
| `targetSdk`  | **36** (Android 16)  | Aktualne wymagania Play / Play Protect  |
| `compileSdk` | **36**               | Kompilacja pod aktualne API             |
| `versionCode`| **4**                | Wyższy niż stare pakiety                |

**Zalecane:** PWA → https://s-pro-v.github.io/scan/ (bez APK).

## Bezpieczeństwo

- brak HTTP cleartext (`usesCleartextTraffic=false` + `network_security_config`)
- brak backupu (`allowBackup=false`)
- kamera: runtime permission + `PermissionRequest` WebView
- assety przez **WebViewAssetLoader** (`https://appassets.androidplatform.net`)
- Safe Browsing WebView, ProGuard / R8 w release
- WhatsApp / zewnętrzne linki w aplikacji systemowej

## Budowa APK (Android Studio)

1. Zainstaluj [Android Studio](https://developer.android.com/studio) (SDK 36).
2. Otwórz folder `android/` jako projekt.
3. Zsynchronizuj WWW:

```bat
cd android
sync-assets.bat
```

4. **Build → Build APK(s)** albo:

```bat
gradlew.bat assembleDebug
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`  
(ID: `com.oxy.sysscanner.debug`)

Release:

```bat
gradlew.bat assembleRelease
```

Wymaga keystore (Studio zaproponuje przy pierwszym release).

## Instalacja

1. Odinstaluj starą aplikację **SYS.SCAN** / **SYS.SCANNER**, jeśli była na telefonie.
2. Zainstaluj nowy APK z tego folderu.
3. Zezwól na kamerę przy pierwszym uruchomieniu.
