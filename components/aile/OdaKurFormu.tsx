"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OyunKimligi } from "@/lib/aile/tipler";
import { aileIstegi } from "./HesapFormu";
import { Ikon } from "./Ikon";

export function OdaKurFormu({ oyun, oyunAdi }: { oyun: OyunKimligi; oyunAdi: string }) {
    const router = useRouter();
    const [ad, setAd] = useState("");
    const [hata, setHata] = useState<string | null>(null);
    const [bekliyor, setBekliyor] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const sonuc = await aileIstegi("/api/aile/oda", { oyun, ad });
        if (!sonuc.ok) {
            setHata(sonuc.hata);
            setBekliyor(false);
            return;
        }
        router.push(`/oda/${(sonuc.veri as { kod: string }).kod}`);
    }

    return (
        <section className="setup-layout spaced" id="oda-kur" aria-labelledby="oda-kur-baslik">
            <form className="panel" onSubmit={onSubmit}>
                <h2 id="oda-kur-baslik" className="sr-only">Oda kur</h2>
                <div className="setting-line">
                    <span className="field-label">Bu odanın oyunu</span>
                    <div className="selected-game">
                        <span className="tiny-art" aria-hidden="true">1–25</span>
                        <div><strong>{oyunAdi}</strong><p className="note">Klasik · 5 × 5 · Herkeste aynı tahta</p></div>
                    </div>
                </div>
                <div className="setting-line">
                    <label className="field-label" htmlFor="oda-adi">Oda adı <span className="muted">(isteğe bağlı)</span></label>
                    <input
                        id="oda-adi"
                        className="input"
                        maxLength={24}
                        placeholder="Akşam oyunları"
                        value={ad}
                        onChange={(e) => setAd(e.target.value)}
                    />
                </div>
                <div className="setting-line">
                    <span className="field-label">Kimler katılabilir?</span>
                    <p>Hesabı olan ve oda kodunu bilen 2–8 oyuncu. Oda herkese açık bir listede görünmez.</p>
                </div>
                {hata && <p className="error" role="alert">{hata}</p>}
                <button className="btn primary full spaced" type="submit" disabled={bekliyor}>
                    Odayı oluştur <Ikon ad="arrow" />
                </button>
            </form>
            <aside className="panel summary-box">
                <h3>Birlikte nasıl oynuyoruz?</h3>
                <ul>
                    <li>Oda kodunu ailenle paylaş.</li>
                    <li>Herkes kendi cihazından katılsın.</li>
                    <li>Hazır olduğunuzda birlikte başlayın.</li>
                </ul>
            </aside>
        </section>
    );
}
