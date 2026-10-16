// Small compositions that show each game's real mechanic (no stock imagery).

export function OyunKapagi({ slug, buyuk, etiket }: { slug: string; buyuk?: boolean; etiket?: string }) {
    const sinif = { "sayi-avi": "art-number", "hafiza-kartlari": "art-memory", "buyuk-hangisi": "art-bigger" }[slug] ?? "";
    return (
        <div className={`game-art ${sinif}${buyuk ? " large-art" : ""}`}>
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
        </div>
    );
}
