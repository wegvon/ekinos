import type Database from "better-sqlite3";
import type { KesinSonuc, KesinToplam, OturumKaydi, TurKaydi } from "./oda";
import type { OyunKimligi } from "./tipler";

// Persistence for family sessions and their rounds. A session row is written
// when it starts, a round row when its play actually starts; results are
// written once, in one transaction, when each ends.

export interface ProfilOturumu {
    oturumId: string;
    baslangic: number;
    sira: number;
    puan: number;
    oyuncuSayisi: number;
    ayrildi: boolean;
    oyunlar: OyunKimligi[];
}

export function aileDeposu(db: Database.Database) {
    const oturumEkle = db.prepare(
        `INSERT INTO aile_oyun_oturumlari (id, oda_kodu, oyunlar_json, baslangic, durum) VALUES (?, ?, ?, ?, 'suruyor')`
    );
    const oturumTamamla = db.prepare(
        "UPDATE aile_oyun_oturumlari SET durum = 'tamamlandi', bitis = ? WHERE id = ? AND durum = 'suruyor'"
    );
    const oturumKes = db.prepare(
        "UPDATE aile_oyun_oturumlari SET durum = 'kesildi' WHERE id = ? AND durum = 'suruyor'"
    );
    const toplamEkle = db.prepare(
        `INSERT INTO aile_oturum_sonuclari (oturum_id, kullanici_id, sira, puan, oyuncu_sayisi, ayrildi)
         VALUES (?, ?, ?, ?, ?, ?)`
    );
    const turEkle = db.prepare(
        `INSERT INTO aile_turlari (id, oda_kodu, oturum_id, oturum_sirasi, oyun, kural_surumu, icerik_json, baslangic, bitis, durum)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'suruyor')`
    );
    const turTamamla = db.prepare(
        "UPDATE aile_turlari SET durum = 'tamamlandi' WHERE id = ? AND durum = 'suruyor'"
    );
    const turKes = db.prepare("UPDATE aile_turlari SET durum = 'kesildi' WHERE id = ? AND durum = 'suruyor'");
    const sonucEkle = db.prepare(
        `INSERT INTO aile_sonuclari (tur_id, kullanici_id, durum, sira, oyuncu_sayisi, ham_ms, hata, ilerleme, nihai_ms, puan, tur_puani)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    return {
        oturumBasladi(o: OturumKaydi) {
            oturumEkle.run(o.id, o.odaKodu, JSON.stringify(o.oyunlar), o.baslangic);
        },

        /** Returns false when the session was already settled; nothing is written twice. */
        oturumBitti: db.transaction((oturumId: string, toplamlar: KesinToplam[], simdi: number) => {
            if (oturumTamamla.run(simdi, oturumId).changes === 0) return false;
            for (const t of toplamlar) toplamEkle.run(oturumId, t.id, t.sira, t.puan, t.oyuncuSayisi, t.ayrildi ? 1 : 0);
            return true;
        }),

        oturumKesildi(oturumId: string) {
            oturumKes.run(oturumId);
        },

        turBasladi(tur: TurKaydi) {
            turEkle.run(
                tur.id,
                tur.odaKodu,
                tur.oturumId,
                tur.oturumSirasi,
                tur.oyun,
                tur.kuralSurumu,
                JSON.stringify(tur.icerik),
                tur.baslangic,
                tur.bitis
            );
        },

        /** Returns false when the round was already settled; nothing is written twice. */
        turBitti: db.transaction((turId: string, sonuclar: KesinSonuc[]) => {
            if (turTamamla.run(turId).changes === 0) return false;
            for (const s of sonuclar) {
                sonucEkle.run(
                    turId, s.id, s.durum, s.sira, s.oyuncuSayisi, s.hamMs, s.hata, s.ilerleme, s.nihaiMs, s.puan, s.turPuani
                );
            }
            return true;
        }),

        turKesildi(turId: string) {
            turKes.run(turId);
        },

        /** Was the most recent session under this code cut off by a server restart? */
        sonTurKesildiMi(odaKodu: string, simdi: number) {
            const satir = db
                .prepare(
                    `SELECT durum, baslangic FROM aile_oyun_oturumlari WHERE oda_kodu = ? ORDER BY baslangic DESC LIMIT 1`
                )
                .get(odaKodu) as { durum: string; baslangic: number } | undefined;
            return satir?.durum === "kesildi" && simdi - satir.baslangic < 2 * 60 * 60_000;
        },

        profilGecmisi(kullaniciId: string, limit = 20): ProfilOturumu[] {
            const satirlar = db
                .prepare(
                    `SELECT o.id AS oturumId, o.baslangic, o.oyunlar_json AS oyunlarJson, s.sira, s.puan,
                            s.oyuncu_sayisi AS oyuncuSayisi, s.ayrildi
                     FROM aile_oturum_sonuclari s JOIN aile_oyun_oturumlari o ON o.id = s.oturum_id
                     WHERE s.kullanici_id = ? AND o.durum = 'tamamlandi'
                     ORDER BY o.baslangic DESC LIMIT ?`
                )
                .all(kullaniciId, limit) as (Omit<ProfilOturumu, "oyunlar" | "ayrildi"> & { oyunlarJson: string; ayrildi: number })[];
            return satirlar.map(({ oyunlarJson, ayrildi, ...s }) => ({
                ...s,
                ayrildi: ayrildi === 1,
                oyunlar: JSON.parse(oyunlarJson) as OyunKimligi[],
            }));
        },
    };
}

export type AileDeposu = ReturnType<typeof aileDeposu>;
