import type { OyunKimligi } from "../tipler";

/**
 * The small contract a solo game implements to become a family mode:
 * the server generates shared content, validates each move and ranks results.
 * Deliberately limited to what the first three family games need.
 */
export interface AileOyunu<Icerik, Durum> {
    id: OyunKimligi;
    kuralSurumu: string;
    sureMs: number;
    /** `rastgele(n)` returns an integer in [0, n). */
    icerikUret(rastgele: (n: number) => number): Icerik;
    baslangicDurumu(icerik: Icerik): Durum;
    hamleUygula(durum: Durum, deger: number, gecenMs: number, icerik: Icerik): { durum: Durum; kabul: boolean };
    ozet(durum: Durum): {
        ilerleme: number;
        toplam: number;
        hatalar: number;
        bitti: boolean;
        hamMs: number | null;
        cezaMs: number;
        nihaiMs: number | null;
    };
    karsilastir(a: Durum, b: Durum): number;
}
