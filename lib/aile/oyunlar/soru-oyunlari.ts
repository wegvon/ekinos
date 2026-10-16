import type { AileOyunu } from "./oyun";

// Three quick "answer as many as you can" games share one engine: everyone
// gets the same question list, each answer moves to the next question,
// right +1, wrong −1, the score never drops below zero (spec section 6).

export interface SoruDurumu {
    soru: number;
    puan: number;
    dogru: number;
    yanlis: number;
    bitisMs: number | null;
}

interface SoruKurali<Soru> {
    id: "buyuk-hangisi" | "renk-tuzagi" | "kutu-say";
    kuralSurumu: string;
    sureMs: number;
    soruSayisi: number;
    soruUret(rastgele: (n: number) => number, onceki: Soru | null): Soru;
    secenekSayisi(soru: Soru): number;
    dogruSecenek(soru: Soru): number;
}

function soruOyunu<Soru>(k: SoruKurali<Soru>): AileOyunu<Soru[], SoruDurumu> {
    const oyun: AileOyunu<Soru[], SoruDurumu> = {
        id: k.id,
        kuralSurumu: k.kuralSurumu,
        sureMs: k.sureMs,
        puanli: true,

        icerikUret(rastgele) {
            const sorular: Soru[] = [];
            for (let i = 0; i < k.soruSayisi; i++) sorular.push(k.soruUret(rastgele, sorular.at(-1) ?? null));
            return sorular;
        },

        baslangicDurumu() {
            return { soru: 0, puan: 0, dogru: 0, yanlis: 0, bitisMs: null };
        },

        hamleUygula(durum, deger, gecenMs, sorular) {
            const soru = sorular[durum.soru];
            if (durum.bitisMs !== null || !soru || !Number.isInteger(deger) || deger < 0 || deger >= k.secenekSayisi(soru)) {
                return { durum, kabul: false };
            }
            const dogruMu = deger === k.dogruSecenek(soru);
            const sonraki = durum.soru + 1;
            return {
                durum: {
                    soru: sonraki,
                    puan: Math.max(0, durum.puan + (dogruMu ? 1 : -1)),
                    dogru: durum.dogru + (dogruMu ? 1 : 0),
                    yanlis: durum.yanlis + (dogruMu ? 0 : 1),
                    bitisMs: sonraki >= sorular.length ? gecenMs : null,
                },
                kabul: true,
            };
        },

        ozet(durum) {
            return {
                ilerleme: durum.soru,
                toplam: null,
                hatalar: durum.yanlis,
                bitti: durum.bitisMs !== null,
                puan: durum.puan,
                hamMs: durum.bitisMs,
                cezaMs: 0,
                nihaiMs: durum.bitisMs,
            };
        },

        // Equal points share the place, as the spec says.
        karsilastir(a, b) {
            return b.puan - a.puan;
        },
    };
    return oyun;
}

// ── Büyük Hangisi? (larger-number) ────────────────────────────────────────

export interface BuyukHangisiSorusu {
    sayilar: [number, number];
}

export const buyukHangisi = soruOyunu<BuyukHangisiSorusu>({
    id: "buyuk-hangisi",
    kuralSurumu: "buyuk-hangisi@1",
    sureMs: 30_000,
    soruSayisi: 200,
    soruUret(rastgele) {
        const a = 1 + rastgele(99);
        let b = 1 + rastgele(98);
        if (b >= a) b += 1;
        return { sayilar: [a, b] };
    },
    secenekSayisi: () => 2,
    dogruSecenek: (s) => (s.sayilar[0] > s.sayilar[1] ? 0 : 1),
});

// ── Renk Tuzağı (stroop-effect-test) ──────────────────────────────────────

export const RENKLER = [
    { ad: "KIRMIZI", kod: "#d64545" },
    { ad: "MAVİ", kod: "#2f6fd6" },
    { ad: "YEŞİL", kod: "#2f9b55" },
    { ad: "SARI", kod: "#d9a400" },
] as const;

export interface RenkTuzagiSorusu {
    /** Index into RENKLER of the written word. */
    kelime: number;
    /** Index into RENKLER of the ink; this is the answer. */
    renk: number;
}

export const renkTuzagi = soruOyunu<RenkTuzagiSorusu>({
    id: "renk-tuzagi",
    kuralSurumu: "renk-tuzagi@1",
    sureMs: 30_000,
    soruSayisi: 150,
    soruUret(rastgele, onceki) {
        let renk = rastgele(RENKLER.length);
        if (onceki && renk === onceki.renk) renk = (renk + 1 + rastgele(RENKLER.length - 1)) % RENKLER.length;
        // Mostly a mismatch between word and ink; sometimes they agree.
        const kelime = rastgele(4) === 0 ? renk : (renk + 1 + rastgele(RENKLER.length - 1)) % RENKLER.length;
        return { kelime, renk };
    },
    secenekSayisi: () => RENKLER.length,
    dogruSecenek: (s) => s.renk,
});

// ── Kutu Say (counting-boxes) ─────────────────────────────────────────────

export const KUTU_IZGARA = 25;
export const KUTU_EN_AZ = 3;
export const KUTU_EN_COK = 12;

export interface KutuSaySorusu {
    /** Filled cells of a 5 × 5 grid. */
    kutular: number[];
    secenekler: number[];
}

export const kutuSay = soruOyunu<KutuSaySorusu>({
    id: "kutu-say",
    kuralSurumu: "kutu-say@1",
    sureMs: 30_000,
    soruSayisi: 120,
    soruUret(rastgele) {
        const adet = KUTU_EN_AZ + rastgele(KUTU_EN_COK - KUTU_EN_AZ + 1);
        const hucreler = Array.from({ length: KUTU_IZGARA }, (_, i) => i);
        for (let i = hucreler.length - 1; i > 0; i--) {
            const j = rastgele(i + 1);
            [hucreler[i], hucreler[j]] = [hucreler[j], hucreler[i]];
        }
        // Four neighbouring choices, so the answer is not always in the middle.
        const ilk = Math.max(KUTU_EN_AZ - 1, Math.min(KUTU_EN_COK + 1 - 3, adet - rastgele(4)));
        return {
            kutular: hucreler.slice(0, adet).sort((a, b) => a - b),
            secenekler: [ilk, ilk + 1, ilk + 2, ilk + 3],
        };
    },
    secenekSayisi: (s) => s.secenekler.length,
    dogruSecenek: (s) => s.secenekler.indexOf(s.kutular.length),
});
