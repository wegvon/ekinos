-- Family accounts, sessions and finished room rounds.
CREATE TABLE IF NOT EXISTS kullanicilar (
    id TEXT PRIMARY KEY,
    kullanici_adi TEXT NOT NULL,
    kullanici_adi_norm TEXT NOT NULL UNIQUE,
    sifre_hash TEXT NOT NULL,
    avatar_renk TEXT NOT NULL,
    sifre_degismeli INTEGER NOT NULL DEFAULT 0,
    olusturuldu INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oturumlar (
    id TEXT PRIMARY KEY,
    kullanici_id TEXT NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    olusturuldu INTEGER NOT NULL,
    bitis INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oturumlar_kullanici ON oturumlar(kullanici_id);

CREATE TABLE IF NOT EXISTS aile_turlari (
    id TEXT PRIMARY KEY,
    oda_kodu TEXT NOT NULL,
    oyun TEXT NOT NULL,
    kural_surumu TEXT NOT NULL,
    icerik_json TEXT NOT NULL,
    baslangic INTEGER NOT NULL,
    bitis INTEGER NOT NULL,
    durum TEXT NOT NULL CHECK (durum IN ('suruyor', 'tamamlandi', 'kesildi'))
);
CREATE INDEX IF NOT EXISTS idx_aile_turlari_oda ON aile_turlari(oda_kodu, baslangic);

CREATE TABLE IF NOT EXISTS aile_sonuclari (
    tur_id TEXT NOT NULL REFERENCES aile_turlari(id) ON DELETE CASCADE,
    kullanici_id TEXT NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    durum TEXT NOT NULL CHECK (durum IN ('bitirdi', 'bitiremedi', 'koptu', 'ayrildi')),
    sira INTEGER NOT NULL,
    oyuncu_sayisi INTEGER NOT NULL,
    ham_ms INTEGER,
    hata INTEGER NOT NULL,
    ilerleme INTEGER NOT NULL,
    nihai_ms INTEGER,
    PRIMARY KEY (tur_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_aile_sonuclari_kullanici ON aile_sonuclari(kullanici_id);
