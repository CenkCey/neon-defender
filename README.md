# Neon Defender — Aşama 1

TypeScript, Vite, HTML5 Canvas ve vanilla CSS ile küçük bir uzay oyununun başlangıcı. Bu aşama yalnızca oyun alanını, gemi çizimini ve hareketi kapsar. Düşman, ateş, skor ve Game Over henüz yoktur. Harici görsel veya backend kullanılmaz.

## Çalıştırma

Node.js 22.12+ ve npm ile bu proje klasöründe:

```sh
npm install
npm run dev
```

Terminalde yazan yerel adresi tarayıcıda açın. `index.html` dosyasını doğrudan açmak yerine Vite sunucusunu kullanın. Durdurmak için `Ctrl+C`.

Bu bilgisayarda Node/npm sistem yolunda bulunmadığı için npm proje içindeki, Git'e alınmayan `.tools/` klasöründe hazırlandı. Hazır Node ortamını kullanan alternatif komut:

```sh
PATH="$PWD/.tools/bin:$PATH" npm_config_cache="$PWD/.cache/npm" npm_config_userconfig="$PWD/.cache/npmrc" npm run dev
```

Bu komutu `outputs/neon-defender/` içinde çalıştırın. `.tools/bin/node`, bu bilgisayardaki Codex Node ortamına işaret eder; başka bilgisayarda normal Node/npm kurulumunu kullanın.

## Kontroller

- WASD veya ok tuşlarıyla hareket edin. Birden fazla aynı yön tuşu hızı artırmaz; çapraz hız normalleştirilir.
- Oyun alanı başlangıçta klavye odağını alır. Sonradan alanı tıklayarak veya Tab ile seçerek kontrolleri etkinleştirin.
- Gemi ekran dışına çıkamaz. Kontroller yalnızca oyun alanı odaktayken yakalanır.
- Pencere/Canvas odağı kaybolunca tuşlar temizlenir. Sekme gizlendiğinde güncelleme durur; dönüşte zaman farkı sıfırlanır.
- Responsive sayfa mobil ekrana sığar; bu aşamada dokunmatik kontrol bulunmaz.

## Dosyalar

| Dosya | Görevi |
| --- | --- |
| `index.html` | Başlık, erişilebilir Canvas ve kontrol ipuçları. |
| `src/main.ts` | CSS'i yükler; oyunu, odak bilgisini ve HMR temizliğini bağlar. |
| `src/game.ts` | Tek requestAnimationFrame döngüsü, saniye cinsinden delta time, sahne çizimi ve Canvas ölçeklemesi. |
| `src/input.ts` | Basılı hareket tuşları ve odak kaybında temizlik. |
| `src/player.ts` | Gemi konumu, hareket hesabı, sınırlar ve geometrik gemi çizimi. |
| `src/style.css` | Koyu tema ve responsive yerleşim. |
| `tests/player.test.mjs` | Hareketin zamana bağlılığı, çapraz hız ve dört sınırın kontrolü. |
| `tsconfig.json` | Sıkı TypeScript denetimi; Vite modül çözümlemesi. |
| `package.json` / `package-lock.json` | Komutlar ve kilitlenmiş geliştirme bağımlılıkları. |
| `.gitignore` | Üretilen dosyaları ve yerel araçları Git dışında tutar. |
| `AGENTS.md` | Kapsam, mimari, doğrulama ve Git kuralları. |
| `README.md` | Kurulum, kullanım, dosya görevleri ve kontrol komutları. |
| `CHECKS.md` | Gerçekte çalıştırılan komutlar ve doğrulama sınırları. |
| `preview.jpg` | Yerel tarayıcıdan alınmış ekran görüntüsü. |

Oyun 960 × 540 mantıksal koordinatta çalışır. Canvas görüntüsü ekran oranını koruyarak ölçeklenir; piksel yoğunluğu için arka tampon en fazla 2× büyütülür. Büyük frame gecikmelerinde delta time 50 ms ile sınırlandırılır.

## Kontroller ve derleme

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

Testler Node'un yerleşik test aracı ve TypeScript türlerini silme desteğiyle çalışır; ek test paketi gerekmez. `build`, önce TypeScript kontrolünü yapar, sonra `dist/` çıktısını üretir. `preview`, bu üretim çıktısını yerel sunar. Bu bilgisayarda yukarıdaki PATH öneki diğer npm komutları için de kullanılabilir.

Git checkpoint'leri aşama tamamlandıktan ve kontroller geçtikten sonra oluşturulur. Yıkıcı dosya veya Git işlemleri kullanıcı onayı gerektirir.
