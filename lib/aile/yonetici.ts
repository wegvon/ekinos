import { randomInt, randomUUID } from "node:crypto";
import type { AileDeposu } from "./depo";
import { Oda, type OdaKullanicisi } from "./oda";
import { aileOyunuMu } from "./oyunlar";
import {
    ODA_KODU_ALFABESI,
    ODA_KODU_UZUNLUGU,
    odaKoduGecerliMi,
    odaKoduNormalize,
    type IstemciMesaji,
    type OyunKimligi,
    type SunucuMesaji,
} from "./tipler";

// Owns every live room in this process and routes socket traffic to them.

export interface Soket {
    send(veri: string): void;
    close(kod?: number, sebep?: string): void;
}

interface Baglanti {
    soket: Soket;
    kullaniciId: string;
    kod: string;
    pencereBaslangic: number;
    pencereMesaj: number;
}

const SANIYEDE_EN_COK_MESAJ = 40;
const TIK_MS = 100;

export class OdaYoneticisi {
    readonly odalar = new Map<string, Oda>();
    private baglantilar = new Map<string, Baglanti>();
    private zamanlayici: ReturnType<typeof setInterval> | null = null;

    constructor(
        private depo: AileDeposu,
        private saat: () => number = Date.now,
        private rastgele: (n: number) => number = (n) => randomInt(n)
    ) {}

    baslat() {
        this.zamanlayici ??= setInterval(() => this.tik(), TIK_MS);
        this.zamanlayici.unref?.();
    }

    durdur() {
        if (this.zamanlayici) clearInterval(this.zamanlayici);
        this.zamanlayici = null;
    }

    tik() {
        const simdi = this.saat();
        for (const oda of [...this.odalar.values()]) oda.ilerlet(simdi);
    }

    private yeniKod() {
        for (;;) {
            let kod = "";
            for (let i = 0; i < ODA_KODU_UZUNLUGU; i++) kod += ODA_KODU_ALFABESI[this.rastgele(ODA_KODU_ALFABESI.length)];
            if (!this.odalar.has(kod)) return kod;
        }
    }

    odaKur(sahip: OdaKullanicisi, oyun: OyunKimligi, ad: string | null) {
        const kod = this.yeniKod();
        const oda = new Oda(kod, oyun, ad, sahip, this.saat(), {
            gonder: (baglantiId, mesaj) => this.gonder(baglantiId, mesaj),
            turBasladi: (tur) => this.depo.turBasladi(tur),
            turBitti: (turId, sonuclar) => {
                this.depo.turBitti(turId, sonuclar);
            },
            turKesildi: (turId) => this.depo.turKesildi(turId),
            odaKapandi: (k) => this.odalar.delete(k),
            rastgele: this.rastgele,
            yeniId: () => randomUUID(),
        });
        this.odalar.set(kod, oda);
        return kod;
    }

    /** Attach an authenticated socket to a room. Returns the connection id, or null if refused. */
    baglan(soket: Soket, kullanici: OdaKullanicisi, kodGirdisi: string) {
        const kod = odaKoduNormalize(kodGirdisi);
        const reddet = (hata: "yok" | "gecersiz" | "kesildi" | "dolu" | "tur_suruyor") => {
            soket.send(JSON.stringify({ t: "katilamadi", kod: hata } satisfies SunucuMesaji));
            soket.close(4004, hata);
            return null;
        };
        if (!odaKoduGecerliMi(kod)) return reddet("gecersiz");
        const oda = this.odalar.get(kod);
        if (!oda) return reddet(this.depo.sonTurKesildiMi(kod, this.saat()) ? "kesildi" : "yok");

        const baglantiId = randomUUID();
        const simdi = this.saat();
        this.baglantilar.set(baglantiId, {
            soket,
            kullaniciId: kullanici.id,
            kod,
            pencereBaslangic: simdi,
            pencereMesaj: 0,
        });
        const sonuc = oda.baglan(kullanici, baglantiId, simdi);
        if (!sonuc.ok) {
            this.baglantilar.delete(baglantiId);
            return reddet(sonuc.hata);
        }
        if (sonuc.oncekiBaglanti) this.gonder(sonuc.oncekiBaglanti, { t: "kapandi", sebep: "baska_yerde" });
        return baglantiId;
    }

    mesaj(baglantiId: string, ham: string) {
        const baglanti = this.baglantilar.get(baglantiId);
        if (!baglanti) return;
        const oda = this.odalar.get(baglanti.kod);
        if (!oda) return;
        const simdi = this.saat();

        if (simdi - baglanti.pencereBaslangic >= 1000) {
            baglanti.pencereBaslangic = simdi;
            baglanti.pencereMesaj = 0;
        }
        if (++baglanti.pencereMesaj > SANIYEDE_EN_COK_MESAJ) {
            if (baglanti.pencereMesaj === SANIYEDE_EN_COK_MESAJ + 1) this.gonder(baglantiId, { t: "hata", kod: "cok_hizli" });
            return;
        }

        let m: IstemciMesaji;
        try {
            m = JSON.parse(ham);
        } catch {
            return;
        }
        if (!m || typeof m !== "object") return;
        const kim = baglanti.kullaniciId;
        let hata = null;
        switch (m.t) {
            case "ping":
                if (typeof m.c === "number") this.gonder(baglantiId, { t: "pong", c: m.c, s: simdi });
                return;
            case "hazir":
                hata = oda.hazir(kim, m.deger === true, simdi);
                break;
            case "baslat":
                hata = oda.baslat(kim, simdi);
                break;
            case "hamle":
                oda.hamle(kim, m.turId, m.sira, m.deger, simdi);
                return;
            case "bir_el_daha":
                hata = oda.birElDaha(kim, simdi);
                break;
            case "oyun_degistir":
                hata = oda.oyunDegistir(kim, aileOyunuMu(m.oyun) ? m.oyun : null, simdi);
                break;
            case "ayril":
                oda.ayril(kim, simdi);
                return;
            default:
                return;
        }
        if (hata) this.gonder(baglantiId, { t: "hata", kod: hata });
    }

    kapandi(baglantiId: string) {
        const baglanti = this.baglantilar.get(baglantiId);
        if (!baglanti) return;
        this.baglantilar.delete(baglantiId);
        this.odalar.get(baglanti.kod)?.kop(baglanti.kullaniciId, baglantiId, this.saat());
    }

    private gonder(baglantiId: string, mesaj: SunucuMesaji) {
        const baglanti = this.baglantilar.get(baglantiId);
        if (!baglanti) return;
        try {
            baglanti.soket.send(JSON.stringify(mesaj));
        } catch {
            // The socket's own close event will clean up.
        }
        if (mesaj.t === "kapandi") {
            this.baglantilar.delete(baglantiId);
            baglanti.soket.close(4000, mesaj.sebep);
        }
    }
}

const globalYonetici = globalThis as unknown as { __ekinosOdalar?: OdaYoneticisi };

export function odaYoneticisiniKur(depo: AileDeposu) {
    globalYonetici.__ekinosOdalar ??= new OdaYoneticisi(depo);
    globalYonetici.__ekinosOdalar.baslat();
    return globalYonetici.__ekinosOdalar;
}

/** The process-wide manager, created by the custom server at startup. */
export function odaYoneticisi() {
    const yonetici = globalYonetici.__ekinosOdalar;
    if (!yonetici) throw new Error("Oda yöneticisi başlatılmadı: uygulama server.ts ile çalıştırılmalı.");
    return yonetici;
}
