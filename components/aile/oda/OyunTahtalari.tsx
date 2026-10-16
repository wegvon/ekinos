"use client";

import { useEffect, useState } from "react";
import type { HafizaIstemciDurumu } from "@/lib/aile/oyunlar/hafiza-kartlari";
import type { SayiAviDurumu } from "@/lib/aile/oyunlar/sayi-avi";
import {
    KUTU_IZGARA,
    RENKLER,
    type BuyukHangisiSorusu,
    type KutuSaySorusu,
    type RenkTuzagiSorusu,
    type SoruDurumu,
} from "@/lib/aile/oyunlar/soru-oyunlari";
import type { TurGorunumu } from "@/lib/aile/tipler";

// One board per family game. Each gets the player's current state and
// reports taps as a single number, the move the server validates.

export interface GeriBildirim {
    deger: number;
    dogru: boolean;
    an: number;
}

interface TahtaOzellikleri {
    tur: TurGorunumu;
    durum: unknown;
    geriBildirim: GeriBildirim | null;
    dokun: (deger: number) => void;
    kapali: boolean;
}

export function OyunTahtasi(p: TahtaOzellikleri) {
    switch (p.tur.oyun) {
        case "sayi-avi":
            return <SayiAviTahtasi {...p} />;
        case "hafiza-kartlari":
            return <HafizaTahtasi {...p} />;
        default:
            return <SoruTahtasi {...p} />;
    }
}

/** Respond on touch-down; keyboard users get Enter and Space. */
function dokunusOlaylari(dokun: () => void) {
    return {
        onPointerDown: (e: React.PointerEvent) => {
            if (e.pointerType !== "mouse" || e.button === 0) dokun();
        },
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dokun();
            }
        },
    };
}

function Kapak({ kapali }: { kapali: boolean }) {
    return kapali ? <div className="board-cover" role="status">Bağlantı bekleniyor…</div> : null;
}

// ── Sayı Avı ──────────────────────────────────────────────────────────────

function SayiAviTahtasi({ tur, durum, geriBildirim, dokun, kapali }: TahtaOzellikleri) {
    const { beklenen, hatalar } = durum as SayiAviDurumu;
    const yanlis = geriBildirim && !geriBildirim.dogru ? geriBildirim.deger : null;
    return (
        <>
            <div className="game-target">
                <span>Sıradaki sayı <strong>{beklenen}</strong></span>
                <span>{beklenen - 1} / 25 buldun{hatalar ? ` · ${hatalar} hata` : ""}</span>
            </div>
            <div className="board-wrap">
                <div className="number-board" role="group" aria-label="Sayı tahtası" aria-disabled={kapali}>
                    {(tur.icerik as number[]).map((n) => (
                        <button
                            key={n}
                            type="button"
                            className={n === beklenen - 1 ? "last" : n < beklenen ? "complete" : n === yanlis ? "wrong" : undefined}
                            {...dokunusOlaylari(() => dokun(n))}
                        >
                            {n}
                        </button>
                    ))}
                </div>
                <Kapak kapali={kapali} />
            </div>
        </>
    );
}

// ── Hafıza Kartları ───────────────────────────────────────────────────────

const KART_YUZLERI = ["🍎", "🐟", "⭐", "🌙", "🌼", "🎈", "🐞", "🍀"];
const YANLIS_CIFT_MS = 900;

function HafizaTahtasi({ durum, dokun, kapali }: TahtaOzellikleri) {
    const { gorunen, eslesen, acik, hamle } = durum as HafizaIstemciDurumu;
    const yanlisCift = acik.length === 2;
    // A mismatched pair stays visible briefly, then turns back over on screen.
    const [gizli, setGizli] = useState(false);
    useEffect(() => {
        setGizli(false);
        if (!yanlisCift) return;
        const zamanlayici = setTimeout(() => setGizli(true), YANLIS_CIFT_MS);
        return () => clearTimeout(zamanlayici);
    }, [yanlisCift, hamle]);

    return (
        <>
            <div className="game-target">
                <span>Bulunan çift <strong>{eslesen.length / 2}</strong> / 8</span>
                <span>{hamle} hamle</span>
            </div>
            <div className="board-wrap">
                <div className="memory-board" role="group" aria-label="Kartlar" aria-disabled={kapali}>
                    {gorunen.map((deger, i) => {
                        const eslesti = eslesen.includes(i);
                        const acikta = deger !== null && (eslesti || !(yanlisCift && gizli));
                        const sinif = eslesti ? "matched" : acikta && yanlisCift ? "wrong" : acikta ? "open" : undefined;
                        return (
                            <button
                                key={i}
                                type="button"
                                className={sinif}
                                aria-label={acikta ? `Kart ${i + 1}: ${KART_YUZLERI[deger!]}` : `Kart ${i + 1}, kapalı`}
                                disabled={eslesti}
                                {...dokunusOlaylari(() => dokun(i))}
                            >
                                {acikta ? KART_YUZLERI[deger!] : ""}
                            </button>
                        );
                    })}
                </div>
                <Kapak kapali={kapali} />
            </div>
        </>
    );
}

// ── Question games ────────────────────────────────────────────────────────

function SoruTahtasi({ tur, durum, geriBildirim, dokun, kapali }: TahtaOzellikleri) {
    const d = durum as SoruDurumu;
    const sorular = tur.icerik as unknown[];
    const soru = sorular[d.soru];
    const isaret = geriBildirim ? (geriBildirim.dogru ? "right" : "wrong") : "";
    return (
        <>
            <div className="game-target">
                <span>Puan <strong>{d.puan}</strong></span>
                <span>{d.dogru} doğru · {d.yanlis} yanlış</span>
            </div>
            <div className="board-wrap">
                <div className={`question-board ${isaret}`} aria-live="polite">
                    {soru === undefined ? (
                        <p>Bütün soruları yanıtladın!</p>
                    ) : tur.oyun === "buyuk-hangisi" ? (
                        <BuyukHangisi soru={soru as BuyukHangisiSorusu} dokun={dokun} />
                    ) : tur.oyun === "renk-tuzagi" ? (
                        <RenkTuzagi soru={soru as RenkTuzagiSorusu} dokun={dokun} />
                    ) : (
                        <KutuSay soru={soru as KutuSaySorusu} dokun={dokun} />
                    )}
                </div>
                <Kapak kapali={kapali} />
            </div>
        </>
    );
}

function BuyukHangisi({ soru, dokun }: { soru: BuyukHangisiSorusu; dokun: (d: number) => void }) {
    return (
        <div className="choice-row duel" role="group" aria-label="Büyük olanı seç">
            {soru.sayilar.map((n, i) => (
                <button key={i} type="button" className="choice big" {...dokunusOlaylari(() => dokun(i))}>{n}</button>
            ))}
        </div>
    );
}

function RenkTuzagi({ soru, dokun }: { soru: RenkTuzagiSorusu; dokun: (d: number) => void }) {
    return (
        <>
            <p className="stroop-word" style={{ color: RENKLER[soru.renk].kod }}>{RENKLER[soru.kelime].ad}</p>
            <div className="choice-row colors" role="group" aria-label="Yazının rengini seç">
                {RENKLER.map((r, i) => (
                    <button key={r.ad} type="button" className="choice" {...dokunusOlaylari(() => dokun(i))}>
                        <span className="swatch" style={{ background: r.kod }} aria-hidden="true" />
                        {r.ad.charAt(0) + r.ad.slice(1).toLocaleLowerCase("tr-TR")}
                    </button>
                ))}
            </div>
        </>
    );
}

function KutuSay({ soru, dokun }: { soru: KutuSaySorusu; dokun: (d: number) => void }) {
    const dolu = new Set(soru.kutular);
    return (
        <>
            <div className="box-grid" aria-label="Kutuları say">
                {Array.from({ length: KUTU_IZGARA }, (_, i) => <span key={i} className={dolu.has(i) ? "on" : undefined} />)}
            </div>
            <div className="choice-row" role="group" aria-label="Kaç kutu var?">
                {soru.secenekler.map((n, i) => (
                    <button key={n} type="button" className="choice" {...dokunusOlaylari(() => dokun(i))}>{n}</button>
                ))}
            </div>
        </>
    );
}
