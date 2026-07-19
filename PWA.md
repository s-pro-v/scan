# SYS.SCANNER — PWA

## „Połączenie nie jest bezpieczne” / kamera zablokowana

Przeglądarka blokuje kamerę i PWA przy zwykłym **HTTP po IP** (`http://192.168…`).

| Adres                         | Bezpieczny?        | Kamera / PWA        |
| ----------------------------- | ------------------ | ------------------- |
| `http://localhost:5173`       | tak (tylko ten PC) | działa              |
| `http://192.168.x.x:5173`     | **nie**            | zablokowane         |
| `https://….trycloudflare.com` | tak                | działa na telefonie |

### Telefon (zalecane)

Kliknij dwukrotnie:

**`start-https.bat`**

1. Uruchomi serwer lokalny.
2. Uruchomi tunel Cloudflare.
3. W terminalu pojawi się adres **`https://….trycloudflare.com`** — **ten** otwórz na telefonie.

### Tylko komputer

**`start-local.bat`** → `http://localhost:5173`

## Instalacja PWA

1. Wejdź na **https://s-pro-v.github.io/scan/** (kłódka HTTPS).
2. Chrome → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**.
3. Przycisk **INSTALUJ** w nagłówku (gdy przeglądarka go pokaże).

### Play Protect blokuje „SYS.SCAN”

To zwykle **stara APK**, nie strona WWW. Kliknij OK, odinstaluj starą aplikację z telefonu i korzystaj z PWA powyżej — albo zbuduj nowy APK z folderu `android/` (`targetSdk 36`).

## Pliki PWA

- `manifest.webmanifest`
- `sw.js` (v4)
- przycisk instalacji w nagłówku
