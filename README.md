# FifTen Backend

Bu klasor, FifTen icin Meta Instagram login akisini yoneten en basit backend iskeletini icerir.

## Ne yapiyor

- `/auth/instagram/start` Meta login URL'si uretir
- `/auth/instagram/callback` Meta'dan gelen `code` bilgisini access token'a cevirir

## Kurulum

1. `.env.example` dosyasini `.env` olarak kopyala
2. Degerleri doldur
3. `npm install`
4. `npm run dev`

## Gerekli ortam degiskenleri

- `APP_BASE_URL`
- `FRONTEND_SUCCESS_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_PATH` veya `FIREBASE_SERVICE_ACCOUNT_JSON`

## Firebase Admin kurulumu

En guvenli yontem:

1. Firebase service account JSON dosyasini backend klasorune koy
2. Dosya adini ornegin `firebase-service-account.json` yap
3. `.env` icine su satiri ekle:

`FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`

Alternatif olarak JSON'u tek satir halinde `FIREBASE_SERVICE_ACCOUNT_JSON` olarak da verebilirsin.

## Meta tarafinda girecegin callback URL

`APP_BASE_URL` + `META_REDIRECT_PATH`

Ornek:

`https://your-backend.up.railway.app/auth/instagram/callback`
