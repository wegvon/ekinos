import type { OyunKimligi } from "./tipler";

// The games a session draws from, as shown in the app (spec section 6).

export interface AileOyunKarti {
    oyun: OyunKimligi;
    ad: string;
    etiket: string;
    kisa: string;
    aciklama: string;
    kurallar: string[];
    sure: string;
    /** One line shown in the countdown and on the board. */
    ipucu: string;
}

export const AILE_KATALOGU: AileOyunKarti[] = [
    {
        oyun: "sayi-avi",
        ad: "Sayı Avı",
        etiket: "Dikkat",
        kisa: "Sayıları sırayla bul. Gözlerin ne kadar hızlı?",
        aciklama: "Herkeste aynı sayılar, aynı başlangıç. 1’den 25’e sırayla dokun. En kısa sürede bitiren kazansın.",
        kurallar: [
            "1’den başla, 25’e kadar sayıları sırayla bul.",
            "Yanlış dokunuş sonucuna 2 saniye ekler.",
            "En çok 90 saniyen var. Bitiremeyenler buldukları sayıya göre sıralanır.",
        ],
        sure: "En çok 90 sn",
        ipucu: "1’den 25’e sırayla dokun. Yanlış dokunuş +2 sn.",
    },
    {
        oyun: "hafiza-kartlari",
        ad: "Hafıza Kartları",
        etiket: "Hafıza",
        kisa: "Eşleri aklında tut. En az hamlede tamamla.",
        aciklama: "Herkeste aynı 16 kart. İkişer aç, 8 çifti bul. Daha az hamlede tamamlayan kazanır.",
        kurallar: [
            "Kartların yerleri herkeste aynıdır; açtığın kartlar yalnızca kendi ekranında görünür.",
            "Eşleşmeyen iki kart, bir sonraki karta dokununca kapanır.",
            "Hamleler eşitse daha kısa süre kazanır. Bitiremeyenler buldukları çift sayısına göre sıralanır.",
        ],
        sure: "En çok 90 sn",
        ipucu: "İkişer kart aç, 8 çifti en az hamlede bul.",
    },
    {
        oyun: "buyuk-hangisi",
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
        ipucu: "Büyük sayıya dokun. Doğru +1, yanlış −1.",
    },
    {
        oyun: "renk-tuzagi",
        ad: "Renk Tuzağı",
        etiket: "Odak",
        kisa: "Kelimeyi değil, rengini seç. Kafan karışmasın.",
        aciklama: "Ekranda bir renk adı yazar ama başka bir renkle boyanmıştır. Yazının rengini seç.",
        kurallar: [
            "Kelimenin ne yazdığına değil, hangi renkle yazıldığına bak.",
            "Her doğru yanıt +1, her yanlış yanıt −1 puan. Toplam puan sıfırın altına düşmez.",
            "30 saniye sonunda en çok puanı olan kazanır; eşitler aynı sırayı paylaşır.",
        ],
        sure: "30 sn",
        ipucu: "Yazının rengini seç, kelimeyi değil.",
    },
    {
        oyun: "kutu-say",
        ad: "Kutu Say",
        etiket: "Göz",
        kisa: "Kutuları bir bakışta say. Doğru sayıyı seç.",
        aciklama: "Izgarada birkaç kutu dolu. Kaç tane olduğunu olabildiğince hızlı say ve doğru sayıya dokun.",
        kurallar: [
            "Herkes aynı ızgaraları aynı sırayla görür.",
            "Her doğru yanıt +1, her yanlış yanıt −1 puan. Toplam puan sıfırın altına düşmez.",
            "30 saniye sonunda en çok puanı olan kazanır; eşitler aynı sırayı paylaşır.",
        ],
        sure: "30 sn",
        ipucu: "Dolu kutuları say, doğru sayıya dokun.",
    },
];

export function katalogdan(slug: string) {
    return AILE_KATALOGU.find((k) => k.oyun === slug);
}

export function oyunKarti(oyun: OyunKimligi) {
    return AILE_KATALOGU.find((k) => k.oyun === oyun)!;
}

/** "32,6 sn" — Turkish decimal comma. */
export function sureYaz(ms: number | null) {
    if (ms === null) return "—";
    return `${(ms / 1000).toFixed(1).replace(".", ",")} sn`;
}
