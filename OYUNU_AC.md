# Neon Defender'ı açma

## Bilgisayar

Node.js 22.12+ ve npm kurulu olmalı. Proje kökünde:

```sh
npm ci
npm run dev
```

Terminaldeki adresi açın. WASD veya oklarla hareket edin, Space ile ateş edin. Başlatma veya Game Over sonrası yeniden başlatma için Enter/R kullanılabilir.

Üretim sürümü:

```sh
npm run build
npm run preview
```

Mac'te `Oyunu-Baslat.command`, Windows'ta `Oyunu-Baslat.cmd` aynı işi kolaylaştırır. Açılan terminali açık tutun; durdurmak için Ctrl+C kullanın. `index.html` dosyasını doğrudan açmayın.

## iPhone: yerel uygulama

[iOS kurulum rehberini](IOS_KURULUM.md) izleyin. Kurulumdan sonra Ana Ekran'daki Neon Defender simgesini kullanın. Geliştirme imzası geçerli olduğu sürece bilgisayarın açık veya kablonun bağlı olması gerekmez.

- Drag & Fire: gemiye yakın yerden yatay sürükleyin, ayrı ateş düğmesini tutun.
- Tilt & Tap: eğimi etkinleştirin, gerçek sensör verisini bekleyin ve rahat tutuşunuzu kalibre edin. Oyun alanına dokunarak ateş edin.
- Ⅱ ile duraklatın; Devam et mevcut uçuşa döner, Menüye dön uçuşu bitirir.

## iPhone: Safari / PWA

Üretim çıktısını HTTPS sunan bir hostinge yükleyin ve kendi yayın adresinizi Safari'de açın. Telefonda bilgisayarın `localhost` adresi çalışmaz.

1. Oyunun “Çevrimdışı hazır” durumuna ulaşmasını bekleyin.
2. Safari → Paylaş → Ana Ekran'a Ekle yolunu kullanın.
3. Oluşan simgeden açın ve ilk çevrimdışı hazırlığı çevrimiçi tamamlayın.
4. Uçak modunda kapatıp yeniden açarak cihazda doğrulayın.

Kaynak güncellendiğinde `npm run build` çalıştırıp **dist içeriğinin tamamını** aynı hostinge gönderin. Service worker çalışan oyunu zorla yenilemez; yeni sürümü görmek için açık oyun pencerelerini kapatıp tekrar açmak gerekebilir.

Rekorlar cihaz/adres başına tutulur; Safari, native uygulama ve farklı yayın adresleri arasında eşitlenmez.
