import type { OyunKimligi } from "../tipler";
import { hafizaKartlari } from "./hafiza-kartlari";
import type { AileOyunu } from "./oyun";
import { sayiAvi } from "./sayi-avi";
import { buyukHangisi, kutuSay, renkTuzagi } from "./soru-oyunlari";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AILE_OYUNLARI: Record<OyunKimligi, AileOyunu<any, any>> = {
    "sayi-avi": sayiAvi,
    "hafiza-kartlari": hafizaKartlari,
    "buyuk-hangisi": buyukHangisi,
    "renk-tuzagi": renkTuzagi,
    "kutu-say": kutuSay,
};

export const TUM_OYUNLAR = Object.keys(AILE_OYUNLARI) as OyunKimligi[];

export function aileOyunuMu(deger: unknown): deger is OyunKimligi {
    return typeof deger === "string" && Object.hasOwn(AILE_OYUNLARI, deger);
}

/**
 * The session's play order: `adet` games drawn at random. A game repeats
 * only when the pool is smaller than `adet`, and never twice in a row.
 */
export function oyunSirasiSec(havuz: readonly OyunKimligi[], adet: number, rastgele: (n: number) => number) {
    const sira: OyunKimligi[] = [];
    while (sira.length < adet) {
        const deste = [...havuz];
        for (let i = deste.length - 1; i > 0; i--) {
            const j = rastgele(i + 1);
            [deste[i], deste[j]] = [deste[j], deste[i]];
        }
        if (deste.length > 1 && deste[0] === sira.at(-1)) [deste[0], deste[1]] = [deste[1], deste[0]];
        sira.push(...deste);
    }
    return sira.slice(0, adet);
}
