import type Database from "better-sqlite3";
import type { KesinSonuc, TurKaydi } from "./oda";
import type { OyunKimligi, SonucDurumu } from "./tipler";

// Persistence for family rounds. A round row is written when play actually
// starts; results are written once, in one transaction, when it ends.

export interface ProfilTuru {
    turId: string;
    oyun: OyunKimligi;
    baslangic: number;
    sira: number;
    oyuncuSayisi: number;
    durum: SonucDurumu;
    nihaiMs: number | null;
    hata: number;
    ilerleme: number;
}

export function aileDeposu(db: Database.Database) {
    const turEkle = db.prepare(
        `INSERT INTO aile_turlari (id, oda_kodu, oyun, kural_surumu, icerik_json, baslangic, bitis, durum)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'suruyor')`
    );
    const turTamamla = db.prepare(
        "UPDATE aile_turlari SET durum = 'tamamlandi' WHERE id = ? AND durum = 'suruyor'"
    );
    const turKes = db.prepare("UPDATE aile_turlari SET durum = 'kesildi' WHERE id = ? AND durum = 'suruyor'");
    const sonucEkle = db.prepare(
        `INSERT INTO aile_sonuclari (tur_id, kullanici_id, durum, sira, oyuncu_sayisi, ham_ms, hata, ilerleme, nihai_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    return {
        turBasladi(tur: TurKaydi) {
            turEkle.run(
                tur.id,
                tur.odaKodu,
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
                sonucEkle.run(turId, s.id, s.durum, s.sira, s.oyuncuSayisi, s.hamMs, s.hata, s.ilerleme, s.nihaiMs);
            }
            return true;
        }),

        turKesildi(turId: string) {
            turKes.run(turId);
        },

        /** Was the most recent round in this room cut off by a server restart? */
        sonTurKesildiMi(odaKodu: string, simdi: number) {
            const satir = db
                .prepare("SELECT durum, bitis FROM aile_turlari WHERE oda_kodu = ? ORDER BY baslangic DESC LIMIT 1")
                .get(odaKodu) as { durum: string; bitis: number } | undefined;
            return satir?.durum === "kesildi" && simdi - satir.bitis < 60 * 60_000;
        },

        profilGecmisi(kullaniciId: string, limit = 20): ProfilTuru[] {
            return db
                .prepare(
                    `SELECT t.id AS turId, t.oyun, t.baslangic, s.sira, s.oyuncu_sayisi AS oyuncuSayisi,
                            s.durum, s.nihai_ms AS nihaiMs, s.hata, s.ilerleme
                     FROM aile_sonuclari s JOIN aile_turlari t ON t.id = s.tur_id
                     WHERE s.kullanici_id = ? AND t.durum = 'tamamlandi'
                     ORDER BY t.baslangic DESC LIMIT ?`
                )
                .all(kullaniciId, limit) as ProfilTuru[];
        },
    };
}

export type AileDeposu = ReturnType<typeof aileDeposu>;
