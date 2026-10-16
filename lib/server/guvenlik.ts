// Request hardening shared by the family API routes and the WebSocket upgrade.

type Basliklar = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function baslik(basliklar: Basliklar, ad: string): string | null {
    if (typeof (basliklar as { get?: unknown }).get === "function") {
        return (basliklar as { get(name: string): string | null }).get(ad);
    }
    const deger = (basliklar as Record<string, string | string[] | undefined>)[ad];
    return Array.isArray(deger) ? deger[0] ?? null : deger ?? null;
}

/**
 * State-changing requests must come from our own pages. APP_ORIGIN pins the
 * public origin in production; otherwise the Host the proxy forwarded is used.
 */
export function kaynakGecerli(basliklar: Basliklar) {
    const origin = baslik(basliklar, "origin");
    if (!origin) return false;
    const izinli = process.env.APP_ORIGIN;
    if (izinli) return origin === izinli;
    const host = baslik(basliklar, "x-forwarded-host") ?? baslik(basliklar, "host");
    try {
        return !!host && new URL(origin).host === host.split(",")[0].trim();
    } catch {
        return false;
    }
}

export function istemciAdresi(basliklar: Basliklar, yedek = "yerel") {
    const iletilen = baslik(basliklar, "x-forwarded-for");
    return iletilen?.split(",")[0].trim() || baslik(basliklar, "x-real-ip") || yedek;
}

/** Fixed-window attempt counter; enough for a single-process family server. */
export class OranSiniri {
    private kayitlar = new Map<string, { sayi: number; baslangic: number }>();

    constructor(private limit: number, private pencereMs: number, private simdi = () => Date.now()) {}

    dene(anahtar: string) {
        const zaman = this.simdi();
        if (this.kayitlar.size > 10_000) this.temizle(zaman);
        const kayit = this.kayitlar.get(anahtar);
        if (!kayit || zaman - kayit.baslangic >= this.pencereMs) {
            this.kayitlar.set(anahtar, { sayi: 1, baslangic: zaman });
            return true;
        }
        kayit.sayi += 1;
        return kayit.sayi <= this.limit;
    }

    private temizle(zaman: number) {
        for (const [anahtar, kayit] of this.kayitlar) {
            if (zaman - kayit.baslangic >= this.pencereMs) this.kayitlar.delete(anahtar);
        }
    }
}

const globalSinirlar = globalThis as unknown as { __ekinosSinirlar?: Record<string, OranSiniri> };

export function sinir(ad: "giris" | "kayit" | "odaKodu" | "odaKur") {
    globalSinirlar.__ekinosSinirlar ??= {
        giris: new OranSiniri(10, 5 * 60 * 1000),
        kayit: new OranSiniri(10, 60 * 60 * 1000),
        odaKodu: new OranSiniri(60, 5 * 60 * 1000),
        odaKur: new OranSiniri(20, 10 * 60 * 1000),
    };
    return globalSinirlar.__ekinosSinirlar[ad];
}
