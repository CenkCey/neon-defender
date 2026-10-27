# iOS uygulamasını çalıştırma

Neon Defender, aynı Canvas oyununu Capacitor WKWebView içinde çalıştırır. Oyun dosyaları uygulamaya paketlenir; uzak bir sunucu veya Netlify hesabı gerekmez.

## Gereksinimler

- macOS ve Xcode; gerekli iOS platform bileşenleri kurulmuş olmalı.
- Node.js 22.12+ ve npm.
- Gerçek cihaza imzalama için kendi Apple hesabınız ve bağlı iPhone.

Bu proje Swift Package Manager kullanır; CocoaPods kurulumu gerekmez.

## Kaynakları hazırlama

Proje kökünde:

```sh
npm ci
npm run ios:sync
npm run ios:open
```

Alternatif: Mac'te `iPhone-Icin-Hazirla.command` dosyasını açın. Başlatıcı oyunu derler, native dosyaları eşler ve Xcode projesini açar. Sistem geliştirici dizini ayarını değiştirmez.

## Kendi takımınızla imzalama

Kişisel takım kimliği ortak kaynak dosyasında tutulmaz. `ios/Signing.local.xcconfig` adında, Git'in görmezden geldiği bir dosya oluşturun:

```xcconfig
NEON_DEVELOPMENT_TEAM = YOUR_TEAM_ID
```

`YOUR_TEAM_ID` yerine kendi Apple geliştirme takım kimliğinizi yazın. `ios/Signing.xcconfig` bu isteğe bağlı yerel dosyayı yükler. Bu dosya olmadan projeyi açabilirsiniz; gerçek cihaz imzalaması için takım seçilmesi gerekir.

1. Xcode → Settings → Apple Accounts içinde hesabınızla giriş yapın.
2. `ios/App/App.xcodeproj` içindeki App hedefinin Signing & Capabilities bölümünü açın.
3. Automatically manage signing açık olsun; çözümlenen takımın kendi hesabınız olduğunu kontrol edin.
4. Gerekirse kökteki `capacitor.config.json` ve Xcode'daki bundle identifier değerini birlikte değiştirin. Varsayılan: `app.neondefender.game`.
5. iPhone'u USB ile bağlayın, kilidini açın ve cihaz listesinden seçin.
6. Run ile derleyip yükleyin. Apple hesabı, anahtarlık parolası, cihaz güveni ve Geliştirici Modu onaylarını kendiniz tamamlayın.

İmzalama dosyalarını, sertifikaları, provisioning profillerini veya hesap bilgilerini repoya eklemeyin. Başka bir geliştiricinin cihaz imzası bu kaynaklardan kopyalanmaz.

## Kaynak değişince

```sh
npm run ios:sync
npm run ios:open
```

Xcode'da tekrar Run kullanın. `ios:sync` mevcut native projeyi silip yeniden oluşturmaz; web üretim dosyalarını ve plugin bağımlılıklarını eşler.

Native menü ve oyun ekranı sabittir; WebView yakınlaştırması/kaydırması kapalıdır. Kontrol izinleri ve gerçek sensör verisi denetimi korunur.

## Dağıtım

Bu repo imzalı IPA içermez. Geliştirme imzasının geçerliliği Apple hesabınızın koşullarına bağlıdır. TestFlight veya App Store dağıtımı, ayrı üyelik/imzalama/yayın sürecidir.

## Resmî kaynaklar

- [Capacitor iOS](https://capacitorjs.com/docs/ios)
- [Apple: uygulamayı simülatör ve gerçek cihazda çalıştırma](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
