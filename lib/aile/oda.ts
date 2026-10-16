import { AILE_OYUNLARI, oyunSirasiSec } from "./oyunlar";
import type { AileOyunu } from "./oyunlar/oyun";
import {
    ARA_MS,
    GERI_SAYIM_MS,
    HAREKETSIZ_ODA_MS,
    ILERLEME_ARALIGI_MS,
    KOPMA_PENCERESI_MS,
    ODA_EN_AZ_OYUNCU,
    ODA_KAPASITESI,
    OTURUM_OYUN_SAYISI,
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
    type ToplamSatiri,
} from "./tipler";

// One family session ("oturum" in the product): a lobby, then five random
// games in a row, each with a shared countdown, a server-validated round and
// a short break showing the round and the running totals; then the final
// standings. Pure state machine: time, randomness, sockets and storage come
// in from outside so every rule can be tested by advancing a fake clock.

export interface OdaKullanicisi {
    id: string;
    ad: string;
    renk: string;
}

export interface TurKaydi {
    id: string;
    odaKodu: string;
    oturumId: string;
    oturumSirasi: number;
    oyun: OyunKimligi;
    kuralSurumu: string;
    icerik: unknown;
    baslangic: number;
    bitis: number;
}

export interface OturumKaydi {
    id: string;
    odaKodu: string;
    oyunlar: OyunKimligi[];
    baslangic: number;
}

export interface KesinSonuc extends SonucSatiri {
    oyuncuSayisi: number;
}

export interface KesinToplam extends ToplamSatiri {
    oyuncuSayisi: number;
}

export interface OdaCevresi {
    gonder(baglantiId: string, mesaj: SunucuMesaji): void;
    oturumBasladi(oturum: OturumKaydi): void;
    oturumBitti(oturumId: string, toplamlar: KesinToplam[], simdi: number): void;
    oturumKesildi(oturumId: string): void;
    turBasladi(tur: TurKaydi): void;
    turBitti(turId: string, sonuclar: KesinSonuc[]): void;
    turKesildi(turId: string): void;
    odaKapandi(kod: string): void;
    /** Games a session may draw from. */
    oyunHavuzu: readonly OyunKimligi[];
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

interface Skor extends OdaKullanicisi {
    katilmaSirasi: number;
    puan: number;
}

interface AktifTur extends TurKaydi {
    katilimcilar: Map<string, Katilimci>;
    kaydedildi: boolean;
    ilerlemeDegisti: boolean;
    sonIlerlemeYayini: number;
}

interface AktifOturum {
    id: string;
    oyunlar: OyunKimligi[];
    oyunNo: number;
    skorlar: Map<string, Skor>;
    araBitis: number | null;
    sonuclandi: boolean;
}

export type BaglanSonucu = { ok: true; oncekiBaglanti: string | null } | { ok: false; hata: KatilmaHatasi };

export class Oda {
    asama: OdaAsamasi = "bekleme";
    kapali = false;
    private oyuncular = new Map<string, Oyuncu>();
    private sahipId: string;
    private katilmaSayaci = 0;
    private sonEtkinlik: number;
    private oturum: AktifOturum | null = null;
    private tur: AktifTur | null = null;
    private turSonuclari: KesinSonuc[] | null = null;

    constructor(
        readonly kod: string,
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
        return AILE_OYUNLARI[this.tur!.oyun];
    }

    /** The lobby and the final standings take newcomers; a running session does not. */
    private get acikKapi() {
        return this.asama === "bekleme" || this.asama === "bitti";
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
            // Someone who dropped out of a running session keeps their place in it.
            const geriDonen = !this.acikKapi && this.oturum?.skorlar.has(kullanici.id);
            if (!this.acikKapi && !geriDonen) return { ok: false, hata: "tur_suruyor" };
            if (this.oyuncular.size >= ODA_KAPASITESI) return { ok: false, hata: "dolu" };
            this.oyuncuEkle(kullanici, baglantiId, simdi);
            const skor = this.oturum?.skorlar.get(kullanici.id);
            if (skor) this.oyuncular.get(kullanici.id)!.katilmaSirasi = skor.katilmaSirasi;
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
        this.ilerlet(simdi);
        if (!this.kapali) this.durumuYayinla();
    }

    ayril(kullaniciId: string, simdi: number) {
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu) return;
        if (oyuncu.baglantiId) this.cevre.gonder(oyuncu.baglantiId, { t: "kapandi", sebep: "ayrildin" });
        this.oyuncular.delete(kullaniciId);
        this.turdanDus(kullaniciId, "ayrildi");
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

        const rastgele = (n: number) => this.cevre.rastgele(n);
        this.oturum = {
            id: this.cevre.yeniId(),
            oyunlar: oyunSirasiSec(this.cevre.oyunHavuzu, OTURUM_OYUN_SAYISI, rastgele),
            oyunNo: 0,
            skorlar: new Map(
                bagli.map((o) => [o.id, { id: o.id, ad: o.ad, renk: o.renk, katilmaSirasi: o.katilmaSirasi, puan: 0 }])
            ),
            araBitis: null,
            sonuclandi: false,
        };
        this.cevre.oturumBasladi({
            id: this.oturum.id,
            odaKodu: this.kod,
            oyunlar: this.oturum.oyunlar,
            baslangic: simdi,
        });
        this.turSonuclari = null;
        this.turuHazirla(simdi);
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    /** The owner skips the rest of the break between games. */
    devam(kullaniciId: string, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        if (kullaniciId !== this.sahipId) return "yetki_yok";
        if (this.asama !== "tur_sonucu" || !this.oturum) return "gecersiz_asama";
        this.oturum.araBitis = simdi;
        this.ilerlet(simdi);
        return null;
    }

    /** From the final standings back to the lobby with the same group. */
    yeniOturum(kullaniciId: string, simdi: number): IslemHatasi | null {
        this.ilerlet(simdi);
        const oyuncu = this.oyuncular.get(kullaniciId);
        if (!oyuncu) return "yetki_yok";
        if (this.asama === "bitti") this.beklemeyeDon();
        if (this.asama !== "bekleme") return "gecersiz_asama";
        oyuncu.hazir = true;
        this.sonEtkinlik = simdi;
        this.durumuYayinla();
        return null;
    }

    // ── Rounds ─────────────────────────────────────────────────────────────

    private turuHazirla(simdi: number) {
        const oturum = this.oturum!;
        const oyun = oturum.oyunlar[oturum.oyunNo];
        const kural = AILE_OYUNLARI[oyun];
        const icerik = kural.icerikUret((n) => this.cevre.rastgele(n));
        // Everyone still holding a seat plays, including those briefly offline.
        const oyuncular = [...oturum.skorlar.values()]
            .map((s) => this.oyuncular.get(s.id))
            .filter((o): o is Oyuncu => !!o)
            .sort((a, b) => a.katilmaSirasi - b.katilmaSirasi);
        const baslangic = simdi + GERI_SAYIM_MS;
        this.tur = {
            id: this.cevre.yeniId(),
            odaKodu: this.kod,
            oturumId: oturum.id,
            oturumSirasi: oturum.oyunNo,
            oyun,
            kuralSurumu: kural.kuralSurumu,
            icerik,
            baslangic,
            bitis: baslangic + kural.sureMs,
            katilimcilar: new Map(
                oyuncular.map((o) => [
                    o.id,
                    { id: o.id, ad: o.ad, renk: o.renk, durum: kural.baslangicDurumu(icerik), sonSira: 0, disarida: null },
                ])
            ),
            kaydedildi: false,
            ilerlemeDegisti: false,
            sonIlerlemeYayini: 0,
        };
        oturum.araBitis = null;
        this.asama = "geri_sayim";
    }

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
        const onceki = kural.ozet(katilimci.durum);
        katilimci.durum = sonuc.durum;
        const ozet = kural.ozet(sonuc.durum);
        if (ozet.ilerleme !== onceki.ilerleme || ozet.puan !== onceki.puan || ozet.bitti) tur.ilerlemeDegisti = true;
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
                oturumId: tur.oturumId,
                oturumSirasi: tur.oturumSirasi,
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
            // Everyone is gone: an unfinished round or session never counts as completed.
            this.kapat();
            return;
        }

        for (const oyuncu of pencereDolanlar) {
            if (tur?.katilimcilar.has(oyuncu.id)) {
                if (this.turdanDus(oyuncu.id, "koptu")) degisti = true;
            } else if (this.asama !== "geri_sayim" && this.asama !== "oynaniyor") {
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
            const herkesBitti = [...tur.katilimcilar.values()].every((k) => k.disarida || kural.ozet(k.durum).bitti);
            if (simdi >= tur.bitis || herkesBitti) {
                this.turuKesinlestir(simdi);
                return;
            }
            if (tur.ilerlemeDegisti && simdi - tur.sonIlerlemeYayini >= ILERLEME_ARALIGI_MS) {
                tur.ilerlemeDegisti = false;
                tur.sonIlerlemeYayini = simdi;
                this.yayinla({ t: "ilerleme", turId: tur.id, ilerlemeler: this.ilerlemeler() });
            }
        }

        if (this.asama === "tur_sonucu" && this.oturum?.araBitis != null && simdi >= this.oturum.araBitis) {
            this.sonrakiOyun(simdi);
            return;
        }

        if ((this.asama === "bekleme" || this.asama === "bitti") && simdi - this.sonEtkinlik >= HAREKETSIZ_ODA_MS) {
            this.kapat();
            return;
        }

        if (degisti) this.durumuYayinla();
    }

    /** Marks a player out of the running round. Returns whether anything changed. */
    private turdanDus(kullaniciId: string, sebep: "koptu" | "ayrildi") {
        const katilimci = this.tur?.katilimcilar.get(kullaniciId);
        if (!katilimci || katilimci.disarida || this.oyunKurali.ozet(katilimci.durum).bitti) return false;
        katilimci.disarida = sebep;
        this.tur!.ilerlemeDegisti = true;
        return true;
    }

    private turuKesinlestir(simdi: number) {
        const tur = this.tur!;
        const oturum = this.oturum!;
        const kural = this.oyunKurali;
        const katilimcilar = [...tur.katilimcilar.values()];
        const durumu = (k: Katilimci): SonucDurumu =>
            kural.ozet(k.durum).bitti ? "bitirdi" : k.disarida ?? (kural.puanli ? "bitirdi" : "bitiremedi");
        const oncelik = { bitirdi: 0, bitiremedi: 1, koptu: 2, ayrildi: 2 };
        const karsilastir = (a: Katilimci, b: Katilimci) =>
            oncelik[durumu(a)] - oncelik[durumu(b)] || kural.karsilastir(a.durum, b.durum);

        const sonuclar: KesinSonuc[] = katilimcilar.map((k) => {
            const ozet = kural.ozet(k.durum);
            const durum = durumu(k);
            // Shared places: only players strictly better push the rank down.
            const sira = 1 + katilimcilar.filter((d) => karsilastir(d, k) < 0).length;
            const oynadi = durum === "bitirdi" || durum === "bitiremedi";
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
                puan: ozet.puan,
                // First place earns one point per player; dropping out earns none.
                turPuani: oynadi ? katilimcilar.length - sira + 1 : 0,
                oyuncuSayisi: katilimcilar.length,
            };
        });
        sonuclar.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr"));
        for (const s of sonuclar) {
            const skor = oturum.skorlar.get(s.id);
            if (skor) skor.puan += s.turPuani;
        }
        this.cevre.turBitti(tur.id, sonuclar);
        this.tur = null;
        this.turSonuclari = sonuclar;

        const sonOyun = oturum.oyunNo >= oturum.oyunlar.length - 1;
        if (sonOyun) {
            this.oturumuBitir(simdi);
        } else {
            this.asama = "tur_sonucu";
            oturum.araBitis = simdi + ARA_MS;
        }
        this.durumuYayinla();
    }

    private sonrakiOyun(simdi: number) {
        const oturum = this.oturum!;
        const kalanlar = [...oturum.skorlar.keys()].filter((id) => this.oyuncular.has(id));
        if (kalanlar.length === 0) {
            // Only onlookers are left; the session ends with what was played.
            this.oturumuBitir(simdi);
        } else {
            oturum.oyunNo += 1;
            this.turuHazirla(simdi);
        }
        this.durumuYayinla();
    }

    private oturumuBitir(simdi: number) {
        const oturum = this.oturum!;
        oturum.araBitis = null;
        oturum.sonuclandi = true;
        this.asama = "bitti";
        for (const oyuncu of this.oyuncular.values()) oyuncu.hazir = false;
        const toplamlar = this.toplamlar();
        this.cevre.oturumBitti(
            oturum.id,
            toplamlar.map((t) => ({ ...t, oyuncuSayisi: toplamlar.length })),
            simdi
        );
        this.sonEtkinlik = simdi;
    }

    private beklemeyeDon() {
        this.asama = "bekleme";
        this.oturum = null;
        this.turSonuclari = null;
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
        if (this.oturum && !this.oturum.sonuclandi) this.cevre.oturumKesildi(this.oturum.id);
        this.tur = null;
        for (const oyuncu of this.oyuncular.values()) {
            if (oyuncu.baglantiId) this.cevre.gonder(oyuncu.baglantiId, { t: "kapandi", sebep: "oda_kapandi" });
        }
        this.cevre.odaKapandi(this.kod);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    private toplamlar(): ToplamSatiri[] {
        const skorlar = [...(this.oturum?.skorlar.values() ?? [])];
        return [...skorlar]
            .sort((a, b) => b.puan - a.puan || a.katilmaSirasi - b.katilmaSirasi)
            .map((s) => ({
                id: s.id,
                ad: s.ad,
                renk: s.renk,
                sira: 1 + skorlar.filter((d) => d.puan > s.puan).length,
                puan: s.puan,
                ayrildi: !this.oyuncular.has(s.id),
            }));
    }

    private benimTurum(k: Katilimci): BenimTurum {
        const kural = this.oyunKurali;
        const ozet = kural.ozet(k.durum);
        return {
            sonSira: k.sonSira,
            bitti: ozet.bitti,
            disarida: k.disarida,
            ilerleme: ozet.ilerleme,
            hatalar: ozet.hatalar,
            puan: ozet.puan,
            hamMs: ozet.hamMs,
            nihaiMs: ozet.nihaiMs,
            durum: kural.istemciDurumu ? kural.istemciDurumu(k.durum, this.tur!.icerik) : k.durum,
        };
    }

    private ilerlemeler(): IlerlemeGorunumu[] {
        const tur = this.tur;
        if (!tur) return [];
        return [...tur.katilimcilar.values()].map((k) => {
            const ozet = this.oyunKurali.ozet(k.durum);
            return {
                id: k.id,
                ilerleme: ozet.ilerleme,
                toplam: ozet.toplam,
                puan: ozet.puan,
                bitti: ozet.bitti,
                disarida: k.disarida,
            };
        });
    }

    gorunum(izleyenId: string): OdaGorunumu {
        const tur = this.tur;
        const katilimci = tur?.katilimcilar.get(izleyenId);
        const kural = tur ? this.oyunKurali : null;
        return {
            kod: this.kod,
            ad: this.ad,
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
            oyunlar: this.oturum?.oyunlar ?? null,
            oyunNo: this.oturum?.oyunNo ?? 0,
            araBitis: this.oturum?.araBitis ?? null,
            tur:
                tur && kural
                    ? {
                          id: tur.id,
                          oyun: tur.oyun,
                          kuralSurumu: tur.kuralSurumu,
                          icerik: kural.istemciIcerigi ? kural.istemciIcerigi(tur.icerik) : tur.icerik,
                          baslangic: tur.baslangic,
                          bitis: tur.bitis,
                          ben: katilimci ? this.benimTurum(katilimci) : null,
                          ilerlemeler: this.ilerlemeler(),
                      }
                    : null,
            turSonuclari: this.turSonuclari,
            toplamlar: this.toplamlar(),
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
