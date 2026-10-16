import type { OyunKimligi } from "../tipler";
import type { AileOyunu } from "./oyun";
import { sayiAvi } from "./sayi-avi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AILE_OYUNLARI: Record<OyunKimligi, AileOyunu<any, any>> = {
    "sayi-avi": sayiAvi,
};

export function aileOyunuMu(deger: unknown): deger is OyunKimligi {
    return typeof deger === "string" && Object.hasOwn(AILE_OYUNLARI, deger);
}
