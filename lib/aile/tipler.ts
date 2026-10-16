// Wire protocol between the family session server and the session page.
// Kept free of server imports so the client bundle can use it too.
//
// In the product a group plays an "oturum": five random games in a row.
// The code keeps the word "oda" for that group, because "oturum" already
// names login sessions (lib/server/auth.ts).

export type OyunKimligi = "sayi-avi" | "hafiza-kartlari" | "buyuk-hangisi" | "renk-tuzagi" | "kutu-say";
export type OdaAsamasi = "bekleme" | "geri_sayim" | "oynaniyor" | "tur_sonucu" | "bitti";
export type SonucDurumu = "bitirdi" | "bitiremedi" | "koptu" | "ayrildi";

export const ODA_KAPASITESI = 8;
export const ODA_EN_AZ_OYUNCU = 2;
export const OTURUM_OYUN_SAYISI = 5;
export const KOPMA_PENCERESI_MS = 20_000;
export const GERI_SAYIM_MS = 3_000;
export const ARA_MS = 10_000;
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
    /** Null for open-ended games scored by points. */
    toplam: number | null;
    puan: number | null;
    bitti: boolean;
    disarida: SonucDurumu | null;
}

/** The viewer's own round: the game's own state plus a common summary. */
export interface BenimTurum {
    sonSira: number;
    bitti: boolean;
    disarida: SonucDurumu | null;
    ilerleme: number;
    hatalar: number;
    puan: number | null;
    hamMs: number | null;
    nihaiMs: number | null;
    durum: unknown;
}

export interface TurGorunumu {
    id: string;
    oyun: OyunKimligi;
    kuralSurumu: string;
    /** Content as the game shows it to players (hidden parts left out). */
    icerik: unknown;
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
    toplam: number | null;
    /** The game's own score (points, or moves for Hafıza Kartları). */
    puan: number | null;
    /** Session points this round earned. */
    turPuani: number;
}

export interface ToplamSatiri {
    id: string;
    ad: string;
    renk: string;
    sira: number;
    puan: number;
    /** Left the session before the end. */
    ayrildi: boolean;
}

export interface OdaGorunumu {
    kod: string;
    ad: string | null;
    asama: OdaAsamasi;
    sahipId: string;
    oyuncular: OyuncuGorunumu[];
    /** The session's games in play order, once it has started. */
    oyunlar: OyunKimligi[] | null;
    /** Index into `oyunlar` of the current (or just finished) game. */
    oyunNo: number;
    /** When the break after a round ends and the next game starts. */
    araBitis: number | null;
    tur: TurGorunumu | null;
    turSonuclari: SonucSatiri[] | null;
    toplamlar: ToplamSatiri[];
}

export type IstemciMesaji =
    | { t: "ping"; c: number }
    | { t: "hazir"; deger: boolean }
    | { t: "baslat" }
    | { t: "devam" }
    | { t: "hamle"; turId: string; sira: number; deger: number }
    | { t: "yeni_oturum" }
    | { t: "ayril" };

export type KatilmaHatasi = "yok" | "dolu" | "tur_suruyor" | "kesildi" | "gecersiz";

export type IslemHatasi =
    | "yetki_yok"
    | "gecersiz_asama"
    | "az_oyuncu"
    | "hazir_degil"
    | "cok_hizli";

export type SunucuMesaji =
    | { t: "pong"; c: number; s: number }
    | { t: "durum"; benId: string; oda: OdaGorunumu }
    | { t: "ilerleme"; turId: string; ilerlemeler: IlerlemeGorunumu[] }
    | { t: "hamle_sonucu"; turId: string; sira: number; kabul: boolean; ben: BenimTurum }
    | { t: "hata"; kod: IslemHatasi }
    | { t: "katilamadi"; kod: KatilmaHatasi }
    | { t: "kapandi"; sebep: "ayrildin" | "baska_yerde" | "oda_kapandi" };
