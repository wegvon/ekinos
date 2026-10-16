import type { AileOyunu } from "./oyun";

// Family-mode rules for Sayı Avı (schulte-table), spec section 6.
// Bump the rule version whenever scoring changes so old results stay apart.

export const SAYI_AVI_HUCRE = 25;
export const SAYI_AVI_CEZA_MS = 2_000;

export interface SayiAviDurumu {
    beklenen: number;
    hatalar: number;
    bitisMs: number | null;
}

export const sayiAvi: AileOyunu<number[], SayiAviDurumu> = {
    id: "sayi-avi",
    kuralSurumu: "sayi-avi@1",
    sureMs: 90_000,
    puanli: false,

    icerikUret(rastgele) {
        const sayilar = Array.from({ length: SAYI_AVI_HUCRE }, (_, i) => i + 1);
        for (let i = sayilar.length - 1; i > 0; i--) {
            const j = rastgele(i + 1);
            [sayilar[i], sayilar[j]] = [sayilar[j], sayilar[i]];
        }
        return sayilar;
    },

    baslangicDurumu() {
        return { beklenen: 1, hatalar: 0, bitisMs: null };
    },

    hamleUygula(durum, deger, gecenMs) {
        if (durum.bitisMs !== null || !Number.isInteger(deger) || deger < 1 || deger > SAYI_AVI_HUCRE) {
            return { durum, kabul: false };
        }
        // Tapping an already-found number is harmless, as in the solo game.
        if (deger < durum.beklenen) return { durum, kabul: true };
        if (deger > durum.beklenen) return { durum: { ...durum, hatalar: durum.hatalar + 1 }, kabul: true };
        const beklenen = durum.beklenen + 1;
        return {
            durum: { ...durum, beklenen, bitisMs: beklenen > SAYI_AVI_HUCRE ? gecenMs : null },
            kabul: true,
        };
    },

    ozet(durum) {
        const cezaMs = durum.hatalar * SAYI_AVI_CEZA_MS;
        return {
            ilerleme: durum.beklenen - 1,
            toplam: SAYI_AVI_HUCRE,
            hatalar: durum.hatalar,
            puan: null,
            bitti: durum.bitisMs !== null,
            hamMs: durum.bitisMs,
            cezaMs,
            nihaiMs: durum.bitisMs === null ? null : durum.bitisMs + cezaMs,
        };
    },

    karsilastir(a, b) {
        const oa = sayiAvi.ozet(a);
        const ob = sayiAvi.ozet(b);
        if (oa.bitti && ob.bitti) return oa.nihaiMs! - ob.nihaiMs!;
        if (oa.bitti !== ob.bitti) return oa.bitti ? -1 : 1;
        if (oa.ilerleme !== ob.ilerleme) return ob.ilerleme - oa.ilerleme;
        return oa.hatalar - ob.hatalar;
    },
};
