// Line icons from the prototype, drawn from one inline sprite.

const YOLLAR = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 1h8"/>',
    wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.3-1.6M12 20h.01"/>',
    share: '<path d="M12 3v12m-5-7 5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
} as const;

export type IkonAdi = keyof typeof YOLLAR;

export function IkonSprite() {
    return (
        <svg className="icon-defs" aria-hidden="true">
            <defs
                dangerouslySetInnerHTML={{
                    __html: Object.entries(YOLLAR)
                        .map(([ad, yol]) => `<symbol id="i-${ad}" viewBox="0 0 24 24">${yol}</symbol>`)
                        .join(""),
                }}
            />
        </svg>
    );
}

export function Ikon({ ad }: { ad: IkonAdi }) {
    return (
        <svg aria-hidden="true">
            <use href={`#i-${ad}`} />
        </svg>
    );
}

export function Avatar({ ad, renk, buyuk }: { ad: string; renk: string; buyuk?: boolean }) {
    return (
        <span className={buyuk ? "avatar large" : "avatar"} style={{ background: renk, color: "#233b33" }} aria-hidden="true">
            {ad.charAt(0).toLocaleUpperCase("tr-TR")}
        </span>
    );
}
