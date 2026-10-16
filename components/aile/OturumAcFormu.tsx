"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { OTURUM_OYUN_SAYISI } from "@/lib/aile/tipler";
import { aileIstegi } from "./HesapFormu";
import { Ikon } from "./Ikon";

export function OturumAcFormu() {
    const router = useRouter();
    const [ad, setAd] = useState("");
    const [hata, setHata] = useState<string | null>(null);
    const [bekliyor, setBekliyor] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const sonuc = await aileIstegi("/api/aile/oturum", { ad });
        if (!sonuc.ok) {
            setHata(sonuc.hata);
            setBekliyor(false);
            return;
        }
        router.push(`/oturum/${(sonuc.veri as { kod: string }).kod}`);
    }

    return (
        <section className="setup-layout spaced" id="oturum-ac" aria-labelledby="oturum-ac-baslik">
            <form className="panel" onSubmit={onSubmit}>
                <h2 id="oturum-ac-baslik">Oturum aç</h2>
                <div className="setting-line">
                    <label className="field-label" htmlFor="oturum-adi">Oturum adı <span className="muted">(isteğe bağlı)</span></label>
                    <input
                        id="oturum-adi"
                        className="input"
                        maxLength={24}
                        placeholder="Akşam oyunları"
                        value={ad}
                        onChange={(e) => setAd(e.target.value)}
                    />
                </div>
                <div className="setting-line">
                    <span className="field-label">Kimler katılabilir?</span>
                    <p>Hesabı olan ve kodu bilen 2–8 oyuncu. Oturum herkese açık bir listede görünmez.</p>
                </div>
                {hata && <p className="error" role="alert">{hata}</p>}
                <button className="btn primary full spaced" type="submit" disabled={bekliyor}>
                    Oturumu aç <Ikon ad="arrow" />
                </button>
            </form>
            <aside className="panel summary-box">
                <h3>Bir oturum nasıl geçer?</h3>
                <ul>
                    <li>Kodu ailenle paylaş, herkes kendi cihazından katılsın.</li>
                    <li>Başlatınca {OTURUM_OYUN_SAYISI} oyun rastgele sırayla gelir.</li>
                    <li>Her oyunda sıraya göre puan toplanır; sonda podyum var.</li>
                </ul>
            </aside>
        </section>
    );
}
