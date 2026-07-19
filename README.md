# SYS.SCANNER

Mobilny skaner kodów (PWA) — kamera, auto-skan, archiwum, WhatsApp.

## Używaj tego (nie starej APK)

**Aplikacja w przeglądarce / na ekranie głównym:**  
https://s-pro-v.github.io/scan/

1. Otwórz link w **Chrome** (musi być kłódka HTTPS).
2. Menu → **Zainstaluj aplikację** albo **Dodaj do ekranu głównego**.
3. **Nie instaluj** starego pliku `.apk` — Play Protect go blokuje („dla starszej wersji Androida”).

Lokalnie na PC: `start-local.bat` → `http://localhost:5173`  
Na telefonie w sieci lokalnej: `start-https.bat` → adres `https://….trycloudflare.com`

Więcej: [PWA.md](PWA.md)

## Android APK (opcjonalnie)

Nowy wrapper: folder [`android/`](android/) — `targetSdk 36`.  
Instrukcja budowy: [android/README.md](android/README.md)

Po zbudowaniu instaluj **tylko** APK z tego projektu (nie stare pakiety).
