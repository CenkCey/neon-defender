# Neon Defender

[![Test and build](https://github.com/CenkCey/neon-defender/actions/workflows/ci.yml/badge.svg)](https://github.com/CenkCey/neon-defender/actions/workflows/ci.yml)

**Küçük bir gemi. Kocaman bir evren.**

TypeScript ve HTML5 Canvas ile geliştirilen neon temalı bir 2D uzay oyunu. Masaüstünde klavyeyle, telefonda dokunarak oynanır. Aynı kaynak kodu Capacitor ile yerel iOS uygulaması olarak da çalışır.

Oyun motoru, backend veya harici görsel paketi kullanılmaz. Gemiler, düşmanlar ve efektler Canvas üzerinde çizilir.

| Tarayıcı sürümü | Mobil tam ekran uçuş |
| :---: | :---: |
| <img src="docs/screenshots/desktop.jpg" alt="Neon Defender tarayıcı sürümünde düşmanlarla mücadele" width="480"> | <img src="docs/screenshots/mobile.jpg" alt="Dikey ekranda skor, can, gemi ve ateş düğmesi" width="240"> |

> Görüntüler uygulamanın gerçek tarayıcı önizlemeleridir. iPhone sensör veya çoklu dokunma testi yerine geçmez.

## Özellikler

- WASD / ok tuşlarıyla hareket, Space ile sürekli ateş.
- Yaklaşık 180 ms atış aralığı; delta time ile hesaplanan hareket.
- Rastgele düşmanlar, çarpışmalar, 3 can, skor ve cihazda saklanan rekor.
- Skorla artan düşman hızı ve üretim sıklığı.
- Gemi için kontrollü hız artışı: 0 puanda 280, 2.500 puanda 335, 5.000 ve üzeri puanda 390 birim/sn.
- Drag & Fire ve sensör destekleniyorsa Tilt & Tap kontrolleri.
- Mobil uçuşta ekranı dolduran, oranları bozulmayan oyun alanı.
- Duraklatma, Game Over, yeniden başlatma ve menüye dönüş.
- Çevrimdışı PWA önbelleği ve uygulama içine paketlenen iOS sürümü.
- iOS uygulamasında sabit menü/oyun ekranı; çift dokunma ve pinch zoom kapalı.

## Hızlı başlangıç

**Gereksinimler:** Node.js 22.12 veya üzeri ve npm.

```sh
git clone https://github.com/CenkCey/neon-defender.git
cd neon-defender
npm ci
npm run dev
```

Terminalde gösterilen yerel adresi açın. `index.html` dosyasını doğrudan çift tıklayarak çalıştırmayın.

Üretim sürümünü yerelde denemek için:

```sh
npm run build
npm run preview
```

Mac ve Windows için sırasıyla `Oyunu-Baslat.command` ve `Oyunu-Baslat.cmd` başlatıcıları da bulunur. Terminali kapatmak veya Ctrl+C sunucuyu durdurur.

## Kontroller

| Ortam | Hareket | Ateş |
| --- | --- | --- |
| Bilgisayar | WASD veya ok tuşları | Space; sürekli ateş için basılı tut |
| Drag & Fire | Gemiye yakın yerden yatay sürükle | Sağ alttaki ateş düğmesini tut |
| Tilt & Tap | İzin ve kalibrasyon sonrası telefonu sola/sağa eğ | Oyun alanına dokun veya basılı tut |

- **Oyuna başla**, Enter veya R: menüden başlatır; Game Over sonrasında yeniden başlatır.
- **Ⅱ / Devam et:** oyunu duraklatır ve aynı uçuşa döner.
- **Menüye dön:** mevcut uçuşu bitirir; rekor saklanır.
- Odak kaybı ve uygulamanın arka plana alınması oyunu duraklatır, basılı girdileri temizler.

Mobil hareket yataydır. Eğim modu yalnızca kullanılabilir sensör verisi alındığında etkinleşir; izin reddi veya veri yokluğunda Drag & Fire kullanılır. Web sensörleri için HTTPS gerekir.

## Oyun kuralları

Her düşman **100 puan** kazandırır. Geminin düşmanla teması bir can azaltır ve ardından bir saniye koruma sağlar. Ekrandan kaçan düşman can azaltmaz. Üç can bitince oyun durur.

Yeniden başlatma konumları, skoru, canları, mermileri, düşmanları ve zamanlayıcıları sıfırlar. Rekor `localStorage` ile korunur. Rekor farklı cihazlar veya farklı adresler arasında eşitlenmez; depolama kullanılamıyorsa oturum boyunca bellekte tutulur.

## iPhone'da yerel uygulama

**Gereksinimler:** macOS, Xcode, Node/npm ve cihazda imzalama için kendi Apple hesabınız.

```sh
npm ci
npm run ios:sync
npm run ios:open
```

Xcode'da `ios/App/App.xcodeproj` açılır. Kendi geliştirme takımınızı seçin, iPhone'u bağlayın ve Run ile yükleyin. Swift Package Manager kullanılır; CocoaPods gerekmez. İmzalama bilgilerinizi repoya eklemeyin.

Ayrıntılar: [iOS kurulumu](IOS_KURULUM.md) · [iPhone kontrol listesi](IPHONE_TESTING.md).

Native sürüm uzak bir web sitesini yüklemez; üretim dosyaları uygulamanın içine kopyalanır. Bu repo imzalı IPA, TestFlight veya App Store dağıtımı içermez.

## Web / PWA dağıtımı

```sh
npm run build
```

`dist/` içeriğini HTTPS sunan statik bir hostinge yükleyin. Vite göreli dosya yolları üretir; build adımı manifest, ikonlar ve içerik sürümüne bağlı service worker önbelleğini hazırlar. Çalışan oyun zorla güncellenmez.

Safari'de Ana Ekran'a ekleme ve çevrimdışı kontrol adımları [kullanım rehberinde](OYUNU_AC.md) bulunur. Bu depoda herkese açık ve güncel olduğu garanti edilen bir canlı demo bağlantısı sunulmuyor.

## Geliştirme ve kontroller

```sh
npm test
npm run typecheck
npm run build
```

Testler Node'un yerleşik test aracıyla çalışır. **84 otomatik test**; hareket/FPS tutarlılığı, atış aralığı, çarpışmalar, skor/can, yeniden başlatma, depolama, mobil koordinatlar, sensör durumları ve lifecycle temizliğini kapsar.

GitHub Actions her push ve pull request üzerinde temiz bağımlılık kurulumu, test ve üretim derlemesini çalıştırır. Doğrulanan cihaz davranışları ve test sınırları [CHECKS.md](CHECKS.md) içindedir.

## Kaynak yapısı

```text
src/
  main.ts            Sayfa bağlantıları ve arayüz
  game.ts            Tek oyun döngüsü, çizim ve boyutlandırma
  world.ts           Tarayıcıdan bağımsız oyun simülasyonu
  input.ts           Klavye girdileri
  player.ts          Gemi çizimi, hareket ve sınırlar
  bullets.ts         Mermiler ve atış zamanlaması
  enemies.ts         Düşmanlar ve zorluk eğrisi
  collision.ts       Çarpışma çözümü
  effects.ts         Vuruş efektleri
  high-score.ts      Kalıcı rekor
  touch-input.ts     Ayrı hareket/ateş pointer'ları
  tilt.ts            Sensör izni ve kalibrasyon
  mobile-controls.ts Mobil kontrol seçimi
  viewport.ts        Ekrana uygun mantıksal alan
  native.ts          iOS lifecycle bağlantısı
  pwa.ts             Çevrimdışı hazırlık
  config.ts          Oyun ayarları
  style.css          Görsel tema ve ekran düzeni
tests/               Otomatik testler
scripts/             Üretim PWA önbelleği
public/              Manifest ve uygulama ikonları
ios/                 Xcode / Swift Package Manager projesi
docs/screenshots/    README görüntüleri
```

Tek `requestAnimationFrame` döngüsü giriş → hareket → atış → düşmanlar → çarpışmalar → çizim sırasını yönetir. Restart yeni döngü oluşturmaz. Masaüstü 960×540 mantıksal alan kullanır; mobil görünüm ekran oranına uyarlanır. Delta time 50 ms ile sınırlandırılır, Canvas piksel yoğunluğu en fazla 2× olur.

## Katkıda bulunma

Küçük ve odaklı değişiklikler önerin. Oyun motoru, backend veya harici görsel bağımlılığı eklemeyin. Değişiklikten önce [AGENTS.md](AGENTS.md) kurallarını okuyun; testleri ve üretim derlemesini çalıştırın. Mobil davranış için gerçek cihaz testi ile tarayıcı önizlemesini ayrı belirtin.

## Lisans

Bu depoya lisans dosyası eklenmemiştir.
