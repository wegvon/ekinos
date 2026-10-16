import type { AileOyunu } from "./oyun";

// Family-mode rules for Hafıza Kartları (memory-matching-game), spec section 6.
// Everyone gets the same 16 cards. Card faces stay on the server until a
// player turns them, so the layout cannot be read from the page.

export const HAFIZA_KART = 16;
export const HAFIZA_CIFT = HAFIZA_KART / 2;

export interface HafizaDurumu {
    eslesen: number[];
    /** Face-up cards that are not matched: one, or a mismatched pair. */
    acik: number[];
    hamle: number;
    bitisMs: number | null;
}

export interface HafizaIstemciDurumu {
    /** Face value per position, or null while the card is face down. */
    gorunen: (number | null)[];
    eslesen: number[];
    acik: number[];
    hamle: number;
}

export const hafizaKartlari: AileOyunu<number[], HafizaDurumu> = {
    id: "hafiza-kartlari",
    kuralSurumu: "hafiza-kartlari@1",
    sureMs: 90_000,
    puanli: false,

    icerikUret(rastgele) {
        const kartlar = Array.from({ length: HAFIZA_KART }, (_, i) => i % HAFIZA_CIFT);
        for (let i = kartlar.length - 1; i > 0; i--) {
            const j = rastgele(i + 1);
            [kartlar[i], kartlar[j]] = [kartlar[j], kartlar[i]];
        }
        return kartlar;
    },

    baslangicDurumu() {
        return { eslesen: [], acik: [], hamle: 0, bitisMs: null };
    },

    hamleUygula(durum, deger, gecenMs, kartlar) {
        if (
            durum.bitisMs !== null ||
            !Number.isInteger(deger) ||
            deger < 0 ||
            deger >= HAFIZA_KART ||
            durum.eslesen.includes(deger)
        ) {
            return { durum, kabul: false };
        }
        // A mismatched pair turns back over when the next card is chosen.
        const acik = durum.acik.length === 2 ? [] : [...durum.acik];
        if (acik.includes(deger)) return { durum, kabul: true };
        acik.push(deger);
        if (acik.length < 2) return { durum: { ...durum, acik }, kabul: true };

        const hamle = durum.hamle + 1;
        const [a, b] = acik;
        if (kartlar[a] !== kartlar[b]) return { durum: { ...durum, acik, hamle }, kabul: true };
        const eslesen = [...durum.eslesen, a, b];
        return {
            durum: { eslesen, acik: [], hamle, bitisMs: eslesen.length === HAFIZA_KART ? gecenMs : null },
            kabul: true,
        };
    },

    ozet(durum) {
        const cift = durum.eslesen.length / 2;
        return {
            ilerleme: cift,
            toplam: HAFIZA_CIFT,
            hatalar: durum.hamle - cift,
            bitti: durum.bitisMs !== null,
            puan: durum.hamle,
            hamMs: durum.bitisMs,
            cezaMs: 0,
            nihaiMs: durum.bitisMs,
        };
    },

    // Fewer moves wins; equal moves: faster. Unfinished: more pairs, then fewer moves.
    karsilastir(a, b) {
        const aBitti = a.bitisMs !== null;
        const bBitti = b.bitisMs !== null;
        if (aBitti && bBitti) return a.hamle - b.hamle || a.bitisMs! - b.bitisMs!;
        if (aBitti !== bBitti) return aBitti ? -1 : 1;
        return b.eslesen.length - a.eslesen.length || a.hamle - b.hamle;
    },

    istemciIcerigi() {
        return { kartSayisi: HAFIZA_KART };
    },

    istemciDurumu(durum, kartlar): HafizaIstemciDurumu {
        const acikta = new Set([...durum.eslesen, ...durum.acik]);
        return {
            gorunen: kartlar.map((deger, i) => (acikta.has(i) ? deger : null)),
            eslesen: durum.eslesen,
            acik: durum.acik,
            hamle: durum.hamle,
        };
    },
};
