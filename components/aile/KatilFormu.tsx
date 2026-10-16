"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ODA_KODU_UZUNLUGU, odaKoduGecerliMi, odaKoduNormalize } from "@/lib/aile/tipler";
import { Ikon } from "./Ikon";

export function KatilFormu({ ilkHata }: { ilkHata?: string | null }) {
    const router = useRouter();
    const [kod, setKod] = useState("");
    const [hata, setHata] = useState<string | null>(ilkHata ?? null);

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        const temiz = odaKoduNormalize(kod);
        if (!odaKoduGecerliMi(temiz)) {
            setHata("Kod 6 karakter olmalı. Harfleri ve rakamları yeniden kontrol et.");
            return;
        }
        router.push(`/oda/${temiz}`);
    }

    return (
        <form className="panel form-card" onSubmit={onSubmit} noValidate>
            <span className="chip green">Ailen seni bekliyor</span>
            <h1 className="spaced">Kod sende mi?</h1>
            <p className="muted">Odayı kuran kişinin paylaştığı 6 karakterli kodu gir.</p>
            <label className="field-label spaced" htmlFor="oda-kodu">Oda kodu</label>
            <input
                id="oda-kodu"
                className="input code-input"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                maxLength={ODA_KODU_UZUNLUGU + 4}
                value={kod}
                onChange={(e) => {
                    setKod(e.target.value.toLocaleUpperCase("en-US"));
                    setHata(null);
                }}
                aria-invalid={!!hata}
                aria-describedby={hata ? "kod-hata" : undefined}
            />
            {hata && <p className="error spaced" id="kod-hata" role="alert">{hata}</p>}
            <button className="btn primary full spaced" type="submit">Odaya katıl <Ikon ad="arrow" /></button>
            <div className="form-foot"><Link className="text-link" href="/oyna/sayi-avi#oda-kur">Ben oda kuracağım</Link></div>
        </form>
    );
}
