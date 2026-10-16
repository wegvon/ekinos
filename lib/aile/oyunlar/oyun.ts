import type { OyunKimligi } from "../tipler";

/**
 * The small contract a solo game implements to become a family mode:
 * the server generates shared content, validates each move and ranks results.
 * Game modules are pure, so the session page reuses them for instant feedback.
 */
export interface AileOyunu<Icerik, Durum> {
    id: OyunKimligi;
    kuralSurumu: string;
    sureMs: number;
    /**
     * Points games: nobody "finishes"; when time runs out everyone still in
     * the round counts as done and is ranked by score.
     */
    puanli: boolean;
    /** `rastgele(n)` returns an integer in [0, n). */
    icerikUret(rastgele: (n: number) => number): Icerik;
    baslangicDurumu(icerik: Icerik): Durum;
    hamleUygula(durum: Durum, deger: number, gecenMs: number, icerik: Icerik): { durum: Durum; kabul: boolean };
    ozet(durum: Durum): OyunOzeti;
    /** Negative: a ranks above b. Zero: shared place. */
    karsilastir(a: Durum, b: Durum): number;
    /** What players may see of the content. Defaults to all of it. */
    istemciIcerigi?(icerik: Icerik): unknown;
    /** What a player may see of their own state. Defaults to all of it. */
    istemciDurumu?(durum: Durum, icerik: Icerik): unknown;
}

export interface OyunOzeti {
    ilerleme: number;
    /** Null for open-ended games. */
    toplam: number | null;
    hatalar: number;
    bitti: boolean;
    /** Points (higher wins) or moves (Hafıza Kartları); null when unused. */
    puan: number | null;
    hamMs: number | null;
    cezaMs: number;
    nihaiMs: number | null;
}
