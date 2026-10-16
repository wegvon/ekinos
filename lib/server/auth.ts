import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db";

export const OTURUM_CEREZI = "ekinos_oturum";
export const OTURUM_SURESI_MS = 30 * 24 * 60 * 60 * 1000;
// Sliding sessions are only extended once a day to avoid a write per request.
const OTURUM_UZATMA_ESIGI_MS = 24 * 60 * 60 * 1000;

const KULLANICI_ADI_DESENI = /^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ]{3,20}$/u;
export const SIFRE_EN_AZ = 8;
export const SIFRE_EN_COK = 128;

// Calm, readable avatar backgrounds from the family palette; text stays dark.
const AVATAR_RENKLERI = ["#D9EBDB", "#F7D9C9", "#E6E0F3", "#FBE7B5", "#D6E8F2", "#F3D6DE"];

export interface Kullanici {
    id: string;
    kullaniciAdi: string;
    avatarRenk: string;
    sifreDegismeli: boolean;
}

interface KullaniciSatiri {
    id: string;
    kullanici_adi: string;
    avatar_renk: string;
    sifre_degismeli: number;
    sifre_hash: string;
}

function satirdanKullanici(satir: KullaniciSatiri): Kullanici {
    return {
        id: satir.id,
        kullaniciAdi: satir.kullanici_adi,
        avatarRenk: satir.avatar_renk,
        sifreDegismeli: satir.sifre_degismeli === 1,
    };
}

export function kullaniciAdiNormalize(ad: string) {
    return ad.normalize("NFC").toLocaleLowerCase("tr-TR");
}

export function kullaniciAdiHatasi(ad: unknown): string | null {
    if (typeof ad !== "string" || !KULLANICI_ADI_DESENI.test(ad.normalize("NFC"))) {
        return "Kullanıcı adı 3–20 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.";
    }
    return null;
}

export function sifreHatasi(sifre: unknown): string | null {
    if (typeof sifre !== "string" || sifre.length < SIFRE_EN_AZ) {
        return `Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`;
    }
    if (sifre.length > SIFRE_EN_COK) {
        return `Şifre en fazla ${SIFRE_EN_COK} karakter olabilir.`;
    }
    return null;
}

function tokenOzeti(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export type KayitSonucu = { ok: true; kullanici: Kullanici } | { ok: false; hata: string };

export async function kayitOl(kullaniciAdi: unknown, sifre: unknown): Promise<KayitSonucu> {
    const adHatasi = kullaniciAdiHatasi(kullaniciAdi);
    if (adHatasi) return { ok: false, hata: adHatasi };
    const sHatasi = sifreHatasi(sifre);
    if (sHatasi) return { ok: false, hata: sHatasi };

    const ad = (kullaniciAdi as string).normalize("NFC");
    const norm = kullaniciAdiNormalize(ad);
    const db = getDb();
    if (db.prepare("SELECT 1 FROM kullanicilar WHERE kullanici_adi_norm = ?").get(norm)) {
        return { ok: false, hata: "Bu kullanıcı adı alınmış." };
    }

    const sifreHash = await hash(sifre as string);
    const id = randomUUID();
    const renk = AVATAR_RENKLERI[Math.floor(Math.random() * AVATAR_RENKLERI.length)];
    try {
        db.prepare(
            `INSERT INTO kullanicilar (id, kullanici_adi, kullanici_adi_norm, sifre_hash, avatar_renk, olusturuldu)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, ad, norm, sifreHash, renk, Date.now());
    } catch (error) {
        // Two simultaneous sign-ups with the same name: the unique index decides.
        if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
            return { ok: false, hata: "Bu kullanıcı adı alınmış." };
        }
        throw error;
    }
    return { ok: true, kullanici: { id, kullaniciAdi: ad, avatarRenk: renk, sifreDegismeli: false } };
}

// Verifying against a fixed hash when the user does not exist keeps response
// time from revealing which usernames are registered.
let sahteHash: Promise<string> | null = null;

export async function girisYap(kullaniciAdi: unknown, sifre: unknown): Promise<Kullanici | null> {
    if (typeof kullaniciAdi !== "string" || typeof sifre !== "string" || sifre.length > SIFRE_EN_COK) {
        return null;
    }
    const satir = getDb()
        .prepare("SELECT * FROM kullanicilar WHERE kullanici_adi_norm = ?")
        .get(kullaniciAdiNormalize(kullaniciAdi.trim())) as KullaniciSatiri | undefined;
    if (!satir) {
        sahteHash ??= hash(randomBytes(16).toString("hex"));
        await verify(await sahteHash, sifre);
        return null;
    }
    return (await verify(satir.sifre_hash, sifre)) ? satirdanKullanici(satir) : null;
}

export function oturumAc(kullaniciId: string) {
    const token = randomBytes(32).toString("base64url");
    const simdi = Date.now();
    getDb()
        .prepare("INSERT INTO oturumlar (id, kullanici_id, olusturuldu, bitis) VALUES (?, ?, ?, ?)")
        .run(tokenOzeti(token), kullaniciId, simdi, simdi + OTURUM_SURESI_MS);
    return token;
}

export function oturumKullanicisi(token: string | undefined | null): Kullanici | null {
    if (!token || token.length > 100) return null;
    const db = getDb();
    const ozet = tokenOzeti(token);
    const satir = db
        .prepare(
            `SELECT k.*, o.bitis AS oturum_bitis FROM oturumlar o
             JOIN kullanicilar k ON k.id = o.kullanici_id
             WHERE o.id = ?`
        )
        .get(ozet) as (KullaniciSatiri & { oturum_bitis: number }) | undefined;
    if (!satir) return null;
    const simdi = Date.now();
    if (satir.oturum_bitis <= simdi) {
        db.prepare("DELETE FROM oturumlar WHERE id = ?").run(ozet);
        return null;
    }
    if (satir.oturum_bitis - simdi < OTURUM_SURESI_MS - OTURUM_UZATMA_ESIGI_MS) {
        db.prepare("UPDATE oturumlar SET bitis = ? WHERE id = ?").run(simdi + OTURUM_SURESI_MS, ozet);
    }
    return satirdanKullanici(satir);
}

export function oturumKapat(token: string | undefined | null) {
    if (!token) return;
    getDb().prepare("DELETE FROM oturumlar WHERE id = ?").run(tokenOzeti(token));
}

export async function sifreDegistir(kullaniciId: string, yeniSifre: string, korunacakToken?: string) {
    const sifreHash = await hash(yeniSifre);
    const db = getDb();
    db.transaction(() => {
        db.prepare("UPDATE kullanicilar SET sifre_hash = ?, sifre_degismeli = 0 WHERE id = ?").run(
            sifreHash,
            kullaniciId
        );
        // Every other session ends; the one that just changed the password stays.
        db.prepare("DELETE FROM oturumlar WHERE kullanici_id = ? AND id != ?").run(
            kullaniciId,
            korunacakToken ? tokenOzeti(korunacakToken) : ""
        );
    })();
}

export async function sifreDogrula(kullaniciId: string, sifre: string) {
    const satir = getDb().prepare("SELECT sifre_hash FROM kullanicilar WHERE id = ?").get(kullaniciId) as
        | { sifre_hash: string }
        | undefined;
    return !!satir && sifre.length <= SIFRE_EN_COK && (await verify(satir.sifre_hash, sifre));
}

/** Operator tool: issue a temporary password that must be changed at next sign-in. */
export async function geciciSifreAta(kullaniciAdi: string) {
    const db = getDb();
    const satir = db
        .prepare("SELECT id FROM kullanicilar WHERE kullanici_adi_norm = ?")
        .get(kullaniciAdiNormalize(kullaniciAdi)) as { id: string } | undefined;
    if (!satir) return null;
    const gecici = randomBytes(9).toString("base64url");
    const sifreHash = await hash(gecici);
    db.transaction(() => {
        db.prepare("UPDATE kullanicilar SET sifre_hash = ?, sifre_degismeli = 1 WHERE id = ?").run(sifreHash, satir.id);
        db.prepare("DELETE FROM oturumlar WHERE kullanici_id = ?").run(satir.id);
    })();
    return gecici;
}

export function cerezdenToken(cerezBasligi: string | undefined | null) {
    if (!cerezBasligi) return null;
    for (const parca of cerezBasligi.split(";")) {
        const [ad, ...deger] = parca.trim().split("=");
        if (ad === OTURUM_CEREZI) return decodeURIComponent(deger.join("="));
    }
    return null;
}
