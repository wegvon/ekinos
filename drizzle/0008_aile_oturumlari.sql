-- A family "oturum": five games in a row, totals kept per player.
CREATE TABLE IF NOT EXISTS aile_oyun_oturumlari (
    id TEXT PRIMARY KEY,
    oda_kodu TEXT NOT NULL,
    oyunlar_json TEXT NOT NULL,
    baslangic INTEGER NOT NULL,
    bitis INTEGER,
    durum TEXT NOT NULL CHECK (durum IN ('suruyor', 'tamamlandi', 'kesildi'))
);
CREATE INDEX IF NOT EXISTS idx_aile_oyun_oturumlari_oda ON aile_oyun_oturumlari(oda_kodu, baslangic);

CREATE TABLE IF NOT EXISTS aile_oturum_sonuclari (
    oturum_id TEXT NOT NULL REFERENCES aile_oyun_oturumlari(id) ON DELETE CASCADE,
    kullanici_id TEXT NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    sira INTEGER NOT NULL,
    puan INTEGER NOT NULL,
    oyuncu_sayisi INTEGER NOT NULL,
    ayrildi INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (oturum_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_aile_oturum_sonuclari_kullanici ON aile_oturum_sonuclari(kullanici_id);

-- Rounds now belong to a session; older single-game rounds keep NULL.
ALTER TABLE aile_turlari ADD COLUMN oturum_id TEXT REFERENCES aile_oyun_oturumlari(id) ON DELETE CASCADE;
ALTER TABLE aile_turlari ADD COLUMN oturum_sirasi INTEGER;
ALTER TABLE aile_sonuclari ADD COLUMN puan INTEGER;
ALTER TABLE aile_sonuclari ADD COLUMN tur_puani INTEGER NOT NULL DEFAULT 0;
