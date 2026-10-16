"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Ikon } from "./Ikon";

type Mod = "giris" | "kayit";

async function gonder(yol: string, govde: unknown) {
    try {
        const yanit = await fetch(yol, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(govde),
        });
        const veri = (await yanit.json().catch(() => ({}))) as { hata?: string; sifreDegismeli?: boolean };
        return yanit.ok ? { ok: true as const, veri } : { ok: false as const, hata: veri.hata ?? "Bir şeyler ters gitti." };
    } catch {
        return { ok: false as const, hata: "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene." };
    }
}

export { gonder as aileIstegi };

function SifreAlani({ id, deger, degistir, otomatik, yardim }: {
    id: string;
    deger: string;
    degistir: (v: string) => void;
    otomatik: string;
    yardim?: string;
}) {
    const [gorunur, setGorunur] = useState(false);
    return (
        <div className="pw-row">
            <input
                id={id}
                className="input"
                type={gorunur ? "text" : "password"}
                autoComplete={otomatik}
                value={deger}
                onChange={(e) => degistir(e.target.value)}
                aria-describedby={yardim}
                required
            />
            <button type="button" className="pw-toggle" onClick={() => setGorunur((g) => !g)} aria-pressed={gorunur}>
                {gorunur ? "Gizle" : "Göster"}
            </button>
        </div>
    );
}

export function HesapFormu({ mod, sonra }: { mod: Mod; sonra: string }) {
    const [ad, setAd] = useState("");
    const [sifre, setSifre] = useState("");
    const [hata, setHata] = useState<string | null>(null);
    const [bekliyor, setBekliyor] = useState(false);
    const kayit = mod === "kayit";
    const digerSayfa = `${kayit ? "/giris" : "/kayit"}${sonra !== "/oyna" ? `?sonra=${encodeURIComponent(sonra)}` : ""}`;

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const sonuc = await gonder(kayit ? "/api/aile/kayit" : "/api/aile/giris", { kullaniciAdi: ad, sifre });
        if (!sonuc.ok) {
            setHata(sonuc.hata);
            setBekliyor(false);
            return;
        }
        // Full navigation so the server layout picks up the new session cookie.
        window.location.assign(sonuc.veri.sifreDegismeli ? "/sifre" : sonra);
    }

    return (
        <form className="panel form-card" onSubmit={onSubmit} noValidate>
            <Link className="brand" href="/oyna" aria-label="Ekinos">
                <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                <span className="brand-name">ekinos</span>
            </Link>
            {kayit && <span className="chip green spaced">E-posta yok. Doğrulama yok.</span>}
            <h1 className="spaced">{kayit ? "Sen de katıl." : "Hoş geldin."}</h1>
            <p className="muted">
                {kayit ? "Bir kullanıcı adı ve şifre seç. Hepsi bu." : "Ailenin oyun masasında yerin hazır."}
            </p>
            <div className="form-fields spaced">
                <div>
                    <label className="field-label" htmlFor="kullanici-adi">Kullanıcı adı</label>
                    <input
                        id="kullanici-adi"
                        className="input"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={20}
                        value={ad}
                        onChange={(e) => setAd(e.target.value)}
                        aria-describedby={kayit ? "kullanici-adi-yardim" : undefined}
                        required
                    />
                    {kayit && <small className="field-help" id="kullanici-adi-yardim">3–20 karakter: harf, rakam ve alt çizgi.</small>}
                </div>
                <div>
                    <label className="field-label" htmlFor="sifre">Şifre</label>
                    <SifreAlani
                        id="sifre"
                        deger={sifre}
                        degistir={setSifre}
                        otomatik={kayit ? "new-password" : "current-password"}
                        yardim={kayit ? "sifre-yardim" : undefined}
                    />
                    {kayit && <small className="field-help" id="sifre-yardim">En az 8 karakter. Şifreni güvenli bir yerde tut.</small>}
                </div>
                {hata && <p className="error" role="alert">{hata}</p>}
                <button className="btn primary full" type="submit" disabled={bekliyor}>
                    {kayit ? "Hesabımı oluştur" : "Giriş yap"} <Ikon ad="arrow" />
                </button>
            </div>
            <div className="form-foot">
                {kayit ? "Hesabın var mı? " : "İlk kez mi geliyorsun? "}
                <Link className="text-link" href={digerSayfa}>{kayit ? "Giriş yap" : "Hesap oluştur"}</Link>
            </div>
            {!kayit && (
                <details className="demo-note">
                    <summary>Şifremi unuttum</summary>
                    <p>
                        Bu aile kurulumunda e-posta kullanılmaz. Hesabını sıfırlamak için platformu yöneten aile
                        üyesinden yardım iste. Sana geçici bir şifre verecek; ilk girişte yenisini seçeceksin.
                    </p>
                </details>
            )}
        </form>
    );
}

export function SifreFormu({ zorunlu }: { zorunlu: boolean }) {
    const [mevcut, setMevcut] = useState("");
    const [yeni, setYeni] = useState("");
    const [hata, setHata] = useState<string | null>(null);
    const [bekliyor, setBekliyor] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const sonuc = await gonder("/api/aile/sifre", { mevcut, yeni });
        if (!sonuc.ok) {
            setHata(sonuc.hata);
            setBekliyor(false);
            return;
        }
        window.location.assign("/oyna");
    }

    return (
        <form className="panel form-card" onSubmit={onSubmit} noValidate>
            <h1>{zorunlu ? "Yeni şifreni seç." : "Şifreni değiştir."}</h1>
            <p className="muted">
                {zorunlu
                    ? "Geçici şifreyle girdin. Devam etmeden önce yalnızca senin bildiğin bir şifre seç."
                    : "Diğer cihazlardaki oturumların kapanır."}
            </p>
            <div className="form-fields spaced">
                <div>
                    <label className="field-label" htmlFor="mevcut">{zorunlu ? "Geçici şifre" : "Şu anki şifre"}</label>
                    <SifreAlani id="mevcut" deger={mevcut} degistir={setMevcut} otomatik="current-password" />
                </div>
                <div>
                    <label className="field-label" htmlFor="yeni">Yeni şifre</label>
                    <SifreAlani id="yeni" deger={yeni} degistir={setYeni} otomatik="new-password" />
                    <small className="field-help">En az 8 karakter.</small>
                </div>
                {hata && <p className="error" role="alert">{hata}</p>}
                <button className="btn primary full" type="submit" disabled={bekliyor}>Şifreyi kaydet</button>
            </div>
            {!zorunlu && (
                <div className="form-foot"><Link className="text-link" href="/profil">Profile dön</Link></div>
            )}
        </form>
    );
}
