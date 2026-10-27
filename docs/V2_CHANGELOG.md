# V1 → V2 değişiklikleri

V1: 0.1.0 / e0a3e9d. V2: 2.0.0; iPhone 15 kullanıcı kabulü 27 Ekim 2026 tarihinde alındı.

| Alan | V1 | V2 |
| --- | --- | --- |
| Mod | Tek sonsuz arcade akışı | Ortak simülasyonda Campaign + Endless |
| İçerik | Tek düşman, sürekli üretim | 30 level, 3 wave, 3 galaksi, 6 boss, 6 düşman türü |
| İlerleme | Yerel en yüksek skor | Level kilitleri, yıldızlar, level best'leri, Endless kayıtları |
| Hasar | Temas, 3 can, 1 sn koruma | Aynı temel + hostile mermi, Shield ve Endless breach |
| Silah | 180 ms / 640 birim-sn | Aynı temel; 7 sn Rapid Fire 115 ms |
| Atmosfer | Lacivert neon | Frontier, Nebula, Rift; iki saniyelik palet geçişi |
| Mobil | Drag & Fire / Tilt & Tap | Aynı kontroller, kayıtlı kalibrasyon, genişletilmiş safe-area HUD |
| Ses | Yok | Başlangıçta kapalı, hafif sentez geri bildirimi |
| Dağıtım | Vite/PWA/Capacitor iOS | Aynı araçlar; yeni dependency yok |
| Kalite | 84 test | 152 test; simülasyon, kayıt, boss adilliği ve ses/lifecycle kontrolleri |

## Yeni modüller

- content.ts: düzenlenebilir level, düşman, boss ve zorluk içeriği.
- director.ts: ortak wave/run ilerlemesi ve moda özgü kurallar.
- bosses.ts / projectiles.ts: boss AI, telegraph ve düşman mermileri.
- powerups.ts: drop, pickup ve iki güçlendirme.
- progress.ts: güvenli, sürümlü kayıt ve v1 geçişi.
- ui.ts: ekran/navigation ve HTML arayüz.
- themes.ts / audio.ts: hafif palet geçişi ve isteğe bağlı ses.
- tests/v2.test.mjs: davranış ve uç durum kontrolleri.

Orijinal player.ts çizimi, klavye/dokunma temeli, PWA altyapısı ve native wrapper korunur.
Güncel [teknoloji rehberi](V2_TECHNOLOGY_GUIDE.md) ve [PDF](../output/pdf/neon-defender-v2-teknoloji-rehberi.pdf), eklenen sistemleri ve V1-V2 farklarını açıklar.

## Tamamlanan V2: Phase A/B/C

- Endless artık öldürme tabanlı tier ile kesintisizdir; her 10. yenilen boss karşılaşmasında can ödülü kimliği ayrı izlenir.
- Normal düşman baskısı güçlendirildi; altı boss’a özel hareket, HP, faz ve güvenli/uyarılan saldırılar eklendi.
- 14 kısa sentez efekti; async ilk ses açılışı, mute, throttle/voice sınırı ve Web Audio lifecycle yönetimi tamamlandı.
- Son sürüm iPhone’a yüklendi; kullanıcı cihaz kabulünü ve V2 yerel commit hazırlığını onayladı. Ayrıntılar: PHASE_A.md, PHASE_B.md, PHASE_C.md, V2_ACCEPTANCE.md.
