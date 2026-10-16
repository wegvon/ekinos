// Wire protocol between the family room server and the room page.
// Kept free of server imports so the client bundle can use it too.

export type OyunKimligi = "sayi-avi";
export type OdaAsamasi = "bekleme" | "geri_sayim" | "oynaniyor" | "sonuc";
export type SonucDurumu = "bitirdi" | "bitiremedi" | "koptu" | "ayrildi";

export const ODA_KAPASITESI = 8;
export const ODA_EN_AZ_OYUNCU = 2;
export const KOPMA_PENCERESI_MS = 20_000;
export const GERI_SAYIM_MS = 3_000;
export const HAREKETSIZ_ODA_MS = 30 * 60_000;
export const ILERLEME_ARALIGI_MS = 250;

// No 0/O, 1/I/L: codes are read aloud and typed on phones.
export const ODA_KODU_ALFABESI = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ODA_KODU_UZUNLUGU = 6;

export function odaKoduNormalize(girdi: string) {
    return girdi.replace(/\s+/g, "").toLocaleUpperCase("en-US");
}

export function odaKoduGecerliMi(kod: string) {
    return (
        kod.length === ODA_KODU_UZUNLUGU &&
        [...kod].every((harf) => ODA_KODU_ALFABESI.includes(harf))
    );
}

export interface OyuncuGorunumu {
    id: string;
    ad: string;
    renk: string;
    bagli: boolean;
    hazir: boolean;
    sahip: boolean;
    /** Not part of the running round (joined disconnected or was not ready). */
    turDisinda: boolean;
}

export interface IlerlemeGorunumu {
    id: string;
    ilerleme: number;
    toplam: number;
    bitti: boolean;
    disarida: SonucDurumu | null;
}

export interface BenimTurum {
    beklenen: number;
    hatalar: number;
    sonSira: number;
    bitti: boolean;
    disarida: SonucDurumu | null;
    hamMs: number | null;
    nihaiMs: number | null;
}

export interface TurGorunumu {
    id: string;
    oyun: OyunKimligi;
    kuralSurumu: string;
    icerik: number[];
    baslangic: number;
    bitis: number;
    ben: BenimTurum | null;
    ilerlemeler: IlerlemeGorunumu[];
}

export interface SonucSatiri {
    id: string;
    ad: string;
    renk: string;
    sira: number;
    durum: SonucDurumu;
    hamMs: number | null;
    hata: number;
    cezaMs: number;
    nihaiMs: number | null;
    ilerleme: number;
    toplam: number;
}

export interface OdaGorunumu {
    kod: string;
    ad: string | null;
    oyun: OyunKimligi;
    asama: OdaAsamasi;
    sahipId: string;
    oyuncular: OyuncuGorunumu[];
    tur: TurGorunumu | null;
    sonuclar: SonucSatiri[] | null;
}

export type IstemciMesaji =
    | { t: "ping"; c: number }
    | { t: "hazir"; deger: boolean }
    | { t: "baslat" }
    | { t: "hamle"; turId: string; sira: number; deger: number }
    | { t: "bir_el_daha" }
    | { t: "oyun_degistir"; oyun: OyunKimligi }
    | { t: "ayril" };

export type KatilmaHatasi = "yok" | "dolu" | "tur_suruyor" | "kesildi" | "gecersiz";

export type IslemHatasi =
    | "yetki_yok"
    | "gecersiz_asama"
    | "az_oyuncu"
    | "hazir_degil"
    | "gecersiz_oyun"
    | "cok_hizli";

export type SunucuMesaji =
    | { t: "pong"; c: number; s: number }
    | { t: "durum"; benId: string; oda: OdaGorunumu }
    | { t: "ilerleme"; turId: string; ilerlemeler: IlerlemeGorunumu[] }
    | { t: "hamle_sonucu"; turId: string; sira: number; kabul: boolean; ben: BenimTurum }
    | { t: "hata"; kod: IslemHatasi }
    | { t: "katilamadi"; kod: KatilmaHatasi }
    | { t: "kapandi"; sebep: "ayrildin" | "baska_yerde" | "oda_kapandi" };
