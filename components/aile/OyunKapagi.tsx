import { RENKLER } from "@/lib/aile/oyunlar/soru-oyunlari";

// Small compositions that show each game's real mechanic (no stock imagery).

const SINIF: Record<string, string> = {
    "sayi-avi": "art-number",
    "hafiza-kartlari": "art-memory",
    "buyuk-hangisi": "art-bigger",
    "renk-tuzagi": "art-stroop",
    "kutu-say": "art-frog",
};

export function OyunKapagi({ slug, buyuk, etiket }: { slug: string; buyuk?: boolean; etiket?: string }) {
    return (
        <div className={`game-art ${SINIF[slug] ?? ""}${buyuk ? " large-art" : ""}`}>
            {etiket && <span className="chip soft">{etiket}</span>}
            {slug === "sayi-avi" && (
                <div className="mini-grid" aria-hidden="true">
                    {[8, 3, 6, 4, 1, 9, 2, 7, 5].map((n) => (
                        <span key={n} className={n === 1 ? "selected" : undefined}>{n}</span>
                    ))}
                </div>
            )}
            {slug === "hafiza-kartlari" && (
                <div className="mini-memory" aria-hidden="true">
                    {["✳", "◆", "✳", "◆", "✳", "✳"].map((s, i) => (
                        <span key={i} className={s === "◆" ? "flipped" : undefined}>{s}</span>
                    ))}
                </div>
            )}
            {slug === "buyuk-hangisi" && (
                <div className="number-duel" aria-hidden="true"><span>24</span><span>42</span></div>
            )}
            {slug === "renk-tuzagi" && (
                <div className="word-art" aria-hidden="true" style={{ color: RENKLER[1].kod }}>{RENKLER[0].ad}</div>
            )}
            {slug === "kutu-say" && (
                <div className="mini-boxes" aria-hidden="true">
                    {[1, 0, 1, 1, 0, 0, 1, 0, 1].map((dolu, i) => <span key={i} className={dolu ? "on" : undefined} />)}
                </div>
            )}
        </div>
    );
}
