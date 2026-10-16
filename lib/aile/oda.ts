import { AILE_OYUNLARI, aileOyunuMu } from "./oyunlar";
import type { AileOyunu } from "./oyunlar/oyun";
import {
    GERI_SAYIM_MS,
    HAREKETSIZ_ODA_MS,
    ILERLEME_ARALIGI_MS,
    KOPMA_PENCERESI_MS,
    ODA_EN_AZ_OYUNCU,
    ODA_KAPASITESI,
    type BenimTurum,
    type IlerlemeGorunumu,
    type IslemHatasi,
    type KatilmaHatasi,
    type OdaAsamasi,
    type OdaGorunumu,
    type OyunKimligi,
    type SonucDurumu,
    type SonucSatiri,
    type SunucuMesaji,
} from "./tipler";

// One family room: lobby, shared countdown, a server-validated round and
// results. Pure state machine: time, randomness, sockets and storage come in
// from outside so every rule can be tested by advancing a fake clock.

export interface OdaKullanicisi {
    id: string;
    ad: string;
    renk: string;
}

export interface TurKaydi {
    id: string;
    odaKodu: string;
    oyun: OyunKimligi;
    kuralSurumu: string;
    icerik: unknown;
    baslangic: number;
    bitis: number;
}

export interface KesinSonuc extends SonucSatiri {
    oyuncuSayisi: number;
}

export interface OdaCevresi {
    gonder(baglantiId: string, mesaj: SunucuMesaji): void;
    turBasladi(tur: TurKaydi): void;
    turBitti(turId: string, sonuclar: KesinSonuc[]): void;
    turKesildi(turId: string): void;
    odaKapandi(kod: string): void;
    rastgele(n: number): number;
    yeniId(): string;
}

interface Oyuncu extends OdaKullanicisi {
    katilmaSirasi: number;
    baglantiId: string | null;
    koptuZaman: number | null;
    hazir: boolean;
}

interface Katilimci extends OdaKullanicisi {
    durum: unknown;
    sonSira: number;
    disarida: SonucDurumu | null;
}

interface AktifTur extends TurKaydi {
    katilimcilar: Map<string, Katilimci>;
    kaydedildi: boolean;
    ilerlemeDegisti: boolean;
    sonIlerlemeYayini: number;
}

export type BaglanSonucu = { ok: true; oncekiBaglanti: string | null } | { ok: false; hata: KatilmaHatasi };

export class Oda {
    asama: OdaAsamasi = "bekleme";
    kapali = false;
    private oyuncular = new Map<string, Oyuncu>();
    private sahipId: string;
    private katilmaSayaci = 0;
    private sonEtkinlik: number;
    private tur: AktifTur | null = null;
    private sonuclar: KesinSonuc[] | null = null;

    constructor(
        readonly kod: string,
        public oyun: OyunKimligi,
        readonly ad: string | null,
        sahip: OdaKullanicisi,
        simdi: number,
        private cevre: OdaCevresi
    ) {
        this.sahipId = sahip.id;
        this.sonEtkinlik = simdi;
        // The creator is reserved a seat and gets the usual window to connect.
        this.oyuncuEkle(sahip, null, simdi);
    }

    get oyuncuSayisi() {
        return this.oyuncular.size;
    }

    private get oyunKurali(): AileOyunu<unknown, unknown> {
        return AILE_OYUNLARI[this.tur?.oyun ?? this.oyun];
    }

    private oyuncuEkle(kullanici: OdaKullanicisi, baglantiId: string | null, simdi: number) {
        this.oyuncular.set(kullanici.id, {
            ...kullanici,
            katilmaSirasi: this.katilmaSayaci++,
            baglantiId,
            koptuZaman: baglantiId ? null : simdi,
            hazir: false,
        });
    }

    // ── Connections ────────────────────────────────────────────────────────

    baglan(kullanici: OdaKullanicisi, baglantiId: string, simdi: number): BaglanSonucu {
        this.ilerlet(simdi);
        if (this.kapali) return { ok: false, hata: "yok" };
        const mevcut = this.oyuncular.get(kullanici.id);
        let oncekiBaglanti: string | null = null;
        if (mevcut) {
            // Same account from another tab or device takes over its own seat.
            oncekiBaglanti = mevcut.baglantiId;
            mevcut.baglantiId = baglantiId;
            mevcut.koptuZaman = null;
        } else {
            if (this.asama === "geri_sayim" || this.asama === "oynaniyor") return { ok: false, hata: "tur_suruyor" };
            if (this.oyuncular.size >= ODA_KAPASITESI) return { ok: false, hata: "dolu" };
            this.oyuncuEkle(kullanici, baglantiId, simdi);
        }
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return { ok: true, oncekiBaglanti };
    }

    kop(kullaniciId: string, baglantiId: string, simdi: number) {
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu || oyuncu.baglantiId !== baglantiId) return;
        oyuncu.baglantiId = null;
        oyuncu.koptuZaman = simdi;
        oyuncu.hazir = false;
        if (this.asama === "geri_sayim" && this.tur?.katilimcilar.has(kullaniciId)) {
            this.geriSayimiIptalEt();
        }
        this.ilerlet(simdi);
        if (!this.kapali) this.durumuYayinla();
    }

    ayril(kullaniciId: string, simdi: number) {
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu) return;
        if (oyuncu.baglantiId) this.cevre.gonder(oyuncu.baglantiId, { t: "kapandi", sebep: "ayrildin" });
        this.oyuncular.delete(kullaniciId);
        const katilimci = this.tur?.katilimcilar.get(kullaniciId);
        if (this.asama === "geri_sayim" && katilimci) {
            this.geriSayimiIptalEt();
        } else if (katilimci && !katilimci.disarida && !this.oyunKurali.ozet(katilimci.durum).bitti) {
            katilimci.disarida = "ayrildi";
            this.tur!.ilerlemeDegisti = true;
        }
        if (this.sahipId === kullaniciId) this.sahipligiDevret();
        this.sonEtkinlik = simdi;
        this.ilerlet(simdi);
        if (!this.kapali) this.durumuYayinla();
    }

    // ── Lobby actions ──────────────────────────────────────────────────────

    hazir(kullaniciId: string, deger: boolean, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu) return "yetki_yok";
        if (this.asama !== "bekleme") return "gecersiz_asama";
        oyuncu.hazir = deger;
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    baslat(kullaniciId: string, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        if (kullaniciId !== this.sahipId || !this.oyuncular.has(kullaniciId)) return "yetki_yok";
        if (this.asama !== "bekleme") return "gecersiz_asama";
        const bagli = [...this.oyuncular.values()].filter((o) => o.baglantiId);
        if (bagli.length < ODA_EN_AZ_OYUNCU) return "az_oyuncu";
        if (bagli.some((o) => !o.hazir)) return "hazir_degil";

        const kural = AILE_OYUNLARI[this.oyun];
        const icerik = kural.icerikUret((n) => this.cevre.rastgele(n));
        const baslangic = simdi + GERI_SAYIM_MS;
        this.tur = {
            id: this.cevre.yeniId(),
            odaKodu: this.kod,
            oyun: this.oyun,
            kuralSurumu: kural.kuralSurumu,
            icerik,
            baslangic,
            bitis: baslangic + kural.sureMs,
            katilimcilar: new Map(
                bagli
                    .sort((a, b) => a.katilmaSirasi - b.katilmaSirasi)
                    .map((o) => [
                        o.id,
                        { id: o.id, ad: o.ad, renk: o.renk, durum: kural.baslangicDurumu(icerik), sonSira: 0, disarida: null },
                    ])
            ),
            kaydedildi: false,
            ilerlemeDegisti: false,
            sonIlerlemeYayini: 0,
        };
        this.asama = "geri_sayim";
        this.sonuclar = null;
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    birElDaha(kullaniciId: string, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu) return "yetki_yok";
        if (this.asama === "sonuc") this.beklemeyeDon();
        if (this.asama !== "bekleme") return "gecersiz_asama";
        oyuncu.hazir = true;
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    oyunDegistir(kullaniciId: string, oyun: unknown, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        if (kullaniciId !== this.sahipId) return "yetki_yok";
        if (!aileOyunuMu(oyun)) return "gecersiz_oyun";
        if (this.asama !== "bekleme" && this.asama !== "sonuc") return "gecersiz_asama";
        this.oyun = oyun;
        // Readiness given for the previous game never starts the new one.
        this.beklemeyeDon();
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    // ── Round ──────────────────────────────────────────────────────────────

    hamle(kullaniciId: string, turId: unknown, sira: unknown, deger: unknown, simdi: number) {
        this.ilerlet(simdi);
        const tur = this.tur;
        const katilimci = tur?.katilimcilar.get(kullaniciId);
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!tur || turId !== tur.id || !katilimci || !oyuncu?.baglantiId) return;

        const yanit = (kabul: boolean) =>
            this.cevre.gonder(oyuncu.baglantiId!, {
                t: "hamle_sonucu",
                turId: tur.id,
                sira: typeof sira === "number" ? sira : -1,
                kabul,
                ben: this.benimTurum(katilimci),
            });

        const kural = this.oyunKurali;
        if (
            this.asama !== "oynaniyor" ||
            simdi < tur.baslangic ||
            simdi >= tur.bitis ||
            katilimci.disarida ||
            typeof sira !== "number" ||
            !Number.isInteger(sira) ||
            sira <= katilimci.sonSira ||
            typeof deger !== "number"
        ) {
            yanit(false);
            return;
        }
        const sonuc = kural.hamleUygula(katilimci.durum, deger, simdi - tur.baslangic, tur.icerik);
        katilimci.sonSira = sira;
        if (!sonuc.kabul) {
            yanit(false);
            return;
        }
        const oncekiIlerleme = kural.ozet(katilimci.durum).ilerleme;
        katilimci.durum = sonuc.durum;
        const ozet = kural.ozet(sonuc.durum);
        if (ozet.ilerleme !== oncekiIlerleme || ozet.bitti) tur.ilerlemeDegisti = true;
        this.sonEtkinlik = simdi;
        yanit(true);
        if (ozet.bitti) this.ilerlet(simdi);
    }

    /** Called on a short interval and before every action. */
    ilerlet(simdi: number) {
        if (this.kapali) return;
        const tur = this.tur;

        if (this.asama === "geri_sayim" && tur && simdi >= tur.baslangic) {
            this.asama = "oynaniyor";
            this.cevre.turBasladi({
                id: tur.id,
                odaKodu: tur.odaKodu,
                oyun: tur.oyun,
                kuralSurumu: tur.kuralSurumu,
                icerik: tur.icerik,
                baslangic: tur.baslangic,
                bitis: tur.bitis,
            });
            tur.kaydedildi = true;
            this.durumuYayinla();
        }

        // Seats whose connection stayed away past the reconnect window.
        const pencereDolanlar = [...this.oyuncular.values()].filter(
            (o) => !o.baglantiId && o.koptuZaman !== null && simdi - o.koptuZaman >= KOPMA_PENCERESI_MS
        );
        let degisti = false;

        if (this.oyuncular.size > 0 && pencereDolanlar.length === this.oyuncular.size) {
            // Everyone is gone: an unfinished round never counts as completed.
            this.kapat();
            return;
        }

        for (const oyuncu of pencereDolanlar) {
            const katilimci = tur?.katilimcilar.get(oyuncu.id);
            if (this.asama === "oynaniyor" && katilimci) {
                if (!katilimci.disarida && !this.oyunKurali.ozet(katilimci.durum).bitti) {
                    katilimci.disarida = "koptu";
                    tur!.ilerlemeDegisti = true;
                    degisti = true;
                }
            } else if (this.asama === "bekleme" || this.asama === "sonuc") {
                this.oyuncular.delete(oyuncu.id);
                degisti = true;
            }
            if (this.sahipId === oyuncu.id) {
                this.sahipligiDevret();
                degisti = true;
            }
        }

        if (this.oyuncular.size === 0) {
            this.kapat();
            return;
        }

        if (this.asama === "oynaniyor" && tur) {
            const kural = this.oyunKurali;
            const herkesBitti = [...tur.katilimcilar.values()].every(
                (k) => k.disarida || kural.ozet(k.durum).bitti
            );
            if (simdi >= tur.bitis || herkesBitti) {
                this.turuKesinlestir();
                return;
            }
            if (tur.ilerlemeDegisti && simdi - tur.sonIlerlemeYayini >= ILERLEME_ARALIGI_MS) {
                tur.ilerlemeDegisti = false;
                tur.sonIlerlemeYayini = simdi;
                this.yayinla({ t: "ilerleme", turId: tur.id, ilerlemeler: this.ilerlemeler() });
            }
        }

        if ((this.asama === "bekleme" || this.asama === "sonuc") && simdi - this.sonEtkinlik >= HAREKETSIZ_ODA_MS) {
            this.kapat();
            return;
        }

        if (degisti) this.durumuYayinla();
    }

    private turuKesinlestir() {
        const tur = this.tur!;
        const kural = this.oyunKurali;
        const katilimcilar = [...tur.katilimcilar.values()];
        const sonuclar: KesinSonuc[] = katilimcilar.map((k) => {
            const ozet = kural.ozet(k.durum);
            const durum: SonucDurumu = ozet.bitti ? "bitirdi" : k.disarida ?? "bitiremedi";
            // Shared places: only players strictly better push the rank down.
            const sira = 1 + katilimcilar.filter((d) => tamKarsilastir(kural, d, k) < 0).length;
            return {
                id: k.id,
                ad: k.ad,
                renk: k.renk,
                sira,
                durum,
                hamMs: ozet.hamMs,
                hata: ozet.hatalar,
                cezaMs: ozet.bitti ? ozet.cezaMs : 0,
                nihaiMs: ozet.nihaiMs,
                ilerleme: ozet.ilerleme,
                toplam: ozet.toplam,
                oyuncuSayisi: katilimcilar.length,
            };
        });
        sonuclar.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr"));
        this.cevre.turBitti(tur.id, sonuclar);
        this.tur = null;
        this.sonuclar = sonuclar;
        this.asama = "sonuc";
        for (const oyuncu of this.oyuncular.values()) oyuncu.hazir = false;
        this.durumuYayinla();
    }

    private geriSayimiIptalEt() {
        this.tur = null;
        this.asama = "bekleme";
        for (const oyuncu of this.oyuncular.values()) oyuncu.hazir = false;
    }

    private beklemeyeDon() {
        this.asama = "bekleme";
        this.sonuclar = null;
        for (const oyuncu of this.oyuncular.values()) oyuncu.hazir = false;
    }

    private sahipligiDevret() {
        const aday = [...this.oyuncular.values()]
            .filter((o) => o.baglantiId)
            .sort((a, b) => a.katilmaSirasi - b.katilmaSirasi)[0];
        if (aday) this.sahipId = aday.id;
    }

    kapat() {
        if (this.kapali) return;
        this.kapali = true;
        if (this.tur?.kaydedildi) this.cevre.turKesildi(this.tur.id);
        this.tur = null;
        for (const oyuncu of this.oyuncular.values()) {
            if (oyuncu.baglantiId) this.cevre.gonder(oyuncu.baglantiId, { t: "kapandi", sebep: "oda_kapandi" });
        }
        this.cevre.odaKapandi(this.kod);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    private benimTurum(k: Katilimci): BenimTurum {
        const ozet = this.oyunKurali.ozet(k.durum);
        const durum = k.durum as { beklenen?: number };
        return {
            beklenen: durum.beklenen ?? 0,
            hatalar: ozet.hatalar,
            sonSira: k.sonSira,
            bitti: ozet.bitti,
            disarida: k.disarida,
            hamMs: ozet.hamMs,
            nihaiMs: ozet.nihaiMs,
        };
    }

    private ilerlemeler(): IlerlemeGorunumu[] {
        const tur = this.tur;
        if (!tur) return [];
        return [...tur.katilimcilar.values()].map((k) => {
            const ozet = this.oyunKurali.ozet(k.durum);
            return { id: k.id, ilerleme: ozet.ilerleme, toplam: ozet.toplam, bitti: ozet.bitti, disarida: k.disarida };
        });
    }

    gorunum(izleyenId: string): OdaGorunumu {
        const tur = this.tur;
        const katilimci = tur?.katilimcilar.get(izleyenId);
        return {
            kod: this.kod,
            ad: this.ad,
            oyun: this.oyun,
            asama: this.asama,
            sahipId: this.sahipId,
            oyuncular: [...this.oyuncular.values()]
                .sort((a, b) => a.katilmaSirasi - b.katilmaSirasi)
                .map((o) => ({
                    id: o.id,
                    ad: o.ad,
                    renk: o.renk,
                    bagli: !!o.baglantiId,
                    hazir: o.hazir,
                    sahip: o.id === this.sahipId,
                    turDisinda: !!tur && !tur.katilimcilar.has(o.id),
                })),
            tur: tur
                ? {
                      id: tur.id,
                      oyun: tur.oyun,
                      kuralSurumu: tur.kuralSurumu,
                      icerik: tur.icerik as number[],
                      baslangic: tur.baslangic,
                      bitis: tur.bitis,
                      ben: katilimci ? this.benimTurum(katilimci) : null,
                      ilerlemeler: this.ilerlemeler(),
                  }
                : null,
            sonuclar: this.sonuclar?.map(({ oyuncuSayisi: _, ...satir }) => satir) ?? null,
        };
    }

    private durumuYayinla() {
        for (const oyuncu of this.oyuncular.values()) {
            if (oyuncu.baglantiId) {
                this.cevre.gonder(oyuncu.baglantiId, { t: "durum", benId: oyuncu.id, oda: this.gorunum(oyuncu.id) });
            }
        }
    }

    private yayinla(mesaj: SunucuMesaji) {
        for (const oyuncu of this.oyuncular.values()) {
            if (oyuncu.baglantiId) this.cevre.gonder(oyuncu.baglantiId, mesaj);
        }
    }
}

/**
 * Finishers first, then players who ran out of time, then those who dropped
 * or left; inside each group the game's own comparison decides.
 */
function tamKarsilastir(kural: AileOyunu<unknown, unknown>, a: Katilimci, b: Katilimci) {
    const oncelik = (k: Katilimci) => (kural.ozet(k.durum).bitti ? 0 : k.disarida ? 2 : 1);
    return oncelik(a) - oncelik(b) || kural.karsilastir(a.durum, b.durum);
}
