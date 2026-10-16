import type { OyunKimligi } from "./tipler";

// Family-mode games as shown in the app. Only games with `acik: true` can
// open rooms; the others are announced with their agreed rules (spec §6).

export interface AileOyunKarti {
    slug: string;
    oyun: OyunKimligi | null;
    ad: string;
    etiket: string;
    kisa: string;
    aciklama: string;
    kurallar: string[];
    sure: string;
    acik: boolean;
}

export const AILE_KATALOGU: AileOyunKarti[] = [
    {
        slug: "sayi-avi",
        oyun: "sayi-avi",
        ad: "Sayı Avı",
        etiket: "Dikkat",
        kisa: "Sayıları sırayla bul. Gözlerin ne kadar hızlı?",
        aciklama:
            "Herkeste aynı sayılar, aynı başlangıç. 1’den 25’e sırayla dokun. En kısa sürede bitiren kazansın.",
        kurallar: [
            "Herkes hazır olduğunda oda sahibi turu başlatır.",
            "1’den başla, 25’e kadar sayıları sırayla bul. Yanlış dokunuş sonucuna 2 saniye ekler.",
            "En çok 90 saniyen var. Bitirince diğerlerini bekle; sonuçları birlikte görün.",
        ],
        sure: "En çok 90 sn",
        acik: true,
    },
    {
        slug: "hafiza-kartlari",
        oyun: null,
        ad: "Hafıza Kartları",
        etiket: "Hafıza",
        kisa: "Eşleri aklında tut. En az hamlede tamamla.",
        aciklama:
            "Herkeste aynı 16 kart. İkişer aç, 8 çifti bul. 90 saniye içinde tamamlayanlar arasında daha az hamle yapan kazanır.",
        kurallar: [
            "Kartların yerleri herkeste aynıdır; açtığın kartlar yalnızca kendi ekranında görünür.",
            "Eşleşmeyen iki kart kısa bir süre sonra tekrar kapanır.",
            "Hamleler eşitse daha kısa süre kazanır. Bitiremeyenler buldukları çift sayısına göre sıralanır.",
        ],
        sure: "En çok 90 sn",
        acik: false,
    },
    {
        slug: "buyuk-hangisi",
        oyun: null,
        ad: "Büyük Hangisi?",
        etiket: "Hız",
        kisa: "Büyük sayıya dokun. Hızlı düşün, doğru seç.",
        aciklama: "30 saniyede mümkün olduğunca çok doğru seçim yap. İki sayıdan büyük olana dokun.",
        kurallar: [
            "Herkes aynı soru dizisiyle başlar; yanıtladıkça bir sonraki soruya geçer.",
            "Her doğru yanıt +1, her yanlış yanıt −1 puan. Toplam puan sıfırın altına düşmez.",
            "Eşit puanlı oyuncular aynı sırayı paylaşır.",
        ],
        sure: "30 sn",
        acik: false,
    },
];

export function katalogdan(slug: string) {
    return AILE_KATALOGU.find((k) => k.slug === slug);
}

export function oyunKarti(oyun: OyunKimligi) {
    return AILE_KATALOGU.find((k) => k.oyun === oyun)!;
}

/** "32,6 sn" — Turkish decimal comma. */
export function sureYaz(ms: number | null) {
    if (ms === null) return "—";
    return `${(ms / 1000).toFixed(1).replace(".", ",")} sn`;
}
