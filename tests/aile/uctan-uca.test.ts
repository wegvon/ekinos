import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { OdaGorunumu, SunucuMesaji } from "@/lib/aile/tipler";

// End to end against the production build (`npm run build` first): real HTTP,
// real WebSockets, real SQLite file. No browser involved.

const KOK = path.resolve(__dirname, "../..");
const HAZIR = fs.existsSync(path.join(KOK, "dist/server.js")) && fs.existsSync(path.join(KOK, ".next/BUILD_ID"));
const PORT = 3900 + Math.floor(Math.random() * 90);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const VERI = fs.mkdtempSync(path.join(os.tmpdir(), "ekinos-e2e-"));
const DB = path.join(VERI, "ekinos.db");
const SIFRELER = { anne: "anne-sifre-123", cocuk: "çocuk şifresi 9" };

let sunucu: ChildProcess | null = null;
let gunluk = "";

async function sunucuyuAc() {
    sunucu = spawn(process.execPath, ["dist/server.js"], {
        cwd: KOK,
        env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: "127.0.0.1", DATABASE_PATH: DB },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let buCalisma = "";
    const kaydet = (d: Buffer) => {
        buCalisma += d;
        gunluk += d;
    };
    sunucu.stdout!.on("data", kaydet);
    sunucu.stderr!.on("data", kaydet);
    const bitis = Date.now() + 60_000;
    while (!buCalisma.includes("Ekinos hazır")) {
        if (Date.now() > bitis) throw new Error(`Sunucu açılmadı:\n${gunluk}`);
        await new Promise((r) => setTimeout(r, 100));
    }
}

async function sunucuyuKapat() {
    if (!sunucu) return;
    const s = sunucu;
    sunucu = null;
    await new Promise((r) => {
        s.once("exit", r);
        s.kill("SIGKILL");
    });
}

async function istek(yol: string, govde?: unknown, cerez?: string, origin: string | null = ORIGIN) {
    const basliklar: Record<string, string> = { "Content-Type": "application/json" };
    if (origin) basliklar.Origin = origin;
    if (cerez) basliklar.Cookie = cerez;
    return fetch(`${ORIGIN}${yol}`, {
        method: govde === undefined ? "GET" : "POST",
        headers: basliklar,
        body: govde === undefined ? undefined : JSON.stringify(govde),
        redirect: "manual",
    });
}

function cerezAl(yanit: Response) {
    const satir = yanit.headers.get("set-cookie") ?? "";
    expect(satir).toMatch(/HttpOnly/i);
    expect(satir).toMatch(/SameSite=lax/i);
    return satir.split(";")[0];
}

class Istemci {
    mesajlar: SunucuMesaji[] = [];
    ws: WebSocket;
    acildi: Promise<void>;
    private sira = 0;

    constructor(kod: string, cerez?: string, origin = ORIGIN) {
        this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?oda=${kod}`, {
            headers: { Origin: origin, ...(cerez ? { Cookie: cerez } : {}) },
        });
        this.ws.on("message", (d) => this.mesajlar.push(JSON.parse(String(d))));
        this.acildi = new Promise((resolve, reject) => {
            this.ws.once("open", () => resolve());
            this.ws.once("unexpected-response", (_q, yanit) => reject(new Error(String(yanit.statusCode))));
            this.ws.once("error", reject);
        });
    }

    gonder(m: unknown) {
        this.ws.send(JSON.stringify(m));
    }

    sonDurum() {
        return ([...this.mesajlar].reverse().find((m) => m.t === "durum") as { oda: OdaGorunumu } | undefined)?.oda;
    }

    async bekle(kosul: (oda: OdaGorunumu) => boolean, ms = 10_000) {
        const bitis = Date.now() + ms;
        for (;;) {
            const oda = this.sonDurum();
            if (oda && kosul(oda)) return oda;
            if (Date.now() > bitis) throw new Error(`Beklenen durum gelmedi: ${JSON.stringify(oda)}`);
            await new Promise((r) => setTimeout(r, 20));
        }
    }

    dokun(turId: string, deger: number) {
        this.gonder({ t: "hamle", turId, sira: ++this.sira, deger });
    }
}

describe.skipIf(!HAZIR)("uçtan uca: iki hesap, bir oda, bir Sayı Avı turu", () => {
    const cerez: Record<string, string> = {};

    beforeAll(sunucuyuAc);
    afterAll(sunucuyuKapat);

    it("e-postasız iki hesap açılır; aynı ada ikinci hesap ve başka kökenden istek reddedilir", async () => {
        for (const [ad, sifre] of Object.entries(SIFRELER)) {
            const yanit = await istek("/api/aile/kayit", { kullaniciAdi: ad, sifre });
            expect(yanit.status).toBe(200);
            const govde = await yanit.text();
            expect(govde).not.toContain(sifre);
            cerez[ad] = cerezAl(yanit);
        }
        expect((await istek("/api/aile/kayit", { kullaniciAdi: "ANNE", sifre: "baskasifre1" })).status).toBe(400);
        expect((await istek("/api/aile/kayit", { kullaniciAdi: "yabanci", sifre: "12345678" }, undefined, "https://kotu.example")).status).toBe(403);
        expect((await istek("/api/aile/kayit", { kullaniciAdi: "yabanci", sifre: "12345678" }, undefined, null)).status).toBe(403);
        const hatali = await istek("/api/aile/giris", { kullaniciAdi: "anne", sifre: "yanlis-sifre" });
        expect(hatali.status).toBe(401);
        expect(await hatali.json()).toEqual({ hata: "Kullanıcı adı veya şifre hatalı." });
    });

    it("korunan sayfalar girişe yönlendirir, oturumla açılır", async () => {
        const yonlenen = await istek("/oyna");
        expect(yonlenen.status).toBe(307);
        expect(yonlenen.headers.get("location")).toContain("/giris?sonra=%2Foyna");
        const acik = await istek("/oyna", undefined, cerez.anne);
        expect(acik.status).toBe(200);
        expect(await acik.text()).toContain("Birlikte daha eğlenceli.");
        // The legacy single-player leaderboard still answers from SQLite.
        expect((await istek("/api/leaderboard?gameId=schulte-table")).status).toBe(200);
    });

    it("oda kurulur, kimliksiz veya yabancı kökenli soket reddedilir, tam bir tur oynanır", async () => {
        const kurulan = await istek("/api/aile/oda", { oyun: "sayi-avi", ad: "Akşam oyunları" }, cerez.anne);
        expect(kurulan.status).toBe(200);
        const { kod } = (await kurulan.json()) as { kod: string };
        expect(kod).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

        await expect(new Istemci(kod).acildi).rejects.toThrow("401");
        await expect(new Istemci(kod, cerez.anne, "https://kotu.example").acildi).rejects.toThrow("403");

        const anne = new Istemci(kod.toLowerCase(), cerez.anne);
        const cocuk = new Istemci(` ${kod} `.replace(/ /g, "%20"), cerez.cocuk);
        await Promise.all([anne.acildi, cocuk.acildi]);
        await anne.bekle((o) => o.oyuncular.length === 2 && o.oyuncular.every((p) => p.bagli));

        anne.gonder({ t: "baslat" });
        await anne.bekle(() => anne.mesajlar.some((m) => m.t === "hata" && m.kod === "hazir_degil"));
        cocuk.gonder({ t: "baslat" });
        await cocuk.bekle(() => cocuk.mesajlar.some((m) => m.t === "hata" && m.kod === "yetki_yok"));

        anne.gonder({ t: "hazir", deger: true });
        cocuk.gonder({ t: "hazir", deger: true });
        await anne.bekle((o) => o.oyuncular.every((p) => p.hazir));
        anne.gonder({ t: "baslat" });
        const odaA = await anne.bekle((o) => o.asama === "geri_sayim");
        const odaC = await cocuk.bekle((o) => o.asama === "geri_sayim");
        const tur = odaA.tur!;
        expect(odaC.tur!.id).toBe(tur.id);
        expect(odaC.tur!.icerik).toEqual(tur.icerik);
        expect(odaC.tur!.baslangic).toBe(tur.baslangic);

        // A third account cannot join while the round runs.
        const ucuncu = await istek("/api/aile/kayit", { kullaniciAdi: "misafir", sifre: "misafir-sifre" });
        const misafir = new Istemci(kod, cerezAl(ucuncu));
        await new Promise((r) => misafir.ws.once("close", r));
        expect(misafir.mesajlar).toEqual([{ t: "katilamadi", kod: "tur_suruyor" }]);

        // Taps before the shared start are refused.
        anne.dokun(tur.id, 1);
        await new Promise((r) => setTimeout(r, Math.max(0, tur.baslangic - Date.now()) + 150));
        for (let n = 1; n <= 25; n++) anne.dokun(tur.id, n);
        cocuk.dokun(tur.id, 9);
        await new Promise((r) => setTimeout(r, 300));
        for (let n = 1; n <= 25; n++) cocuk.dokun(tur.id, n);

        const sonuc = await anne.bekle((o) => o.asama === "sonuc");
        const [birinci, ikinci] = sonuc.sonuclar!;
        expect(birinci).toMatchObject({ ad: "anne", sira: 1, durum: "bitirdi", hata: 0 });
        expect(ikinci).toMatchObject({ ad: "cocuk", sira: 2, durum: "bitirdi", hata: 1, cezaMs: 2000 });
        expect(ikinci.nihaiMs).toBe(ikinci.hamMs! + 2000);
        expect(birinci.hamMs!).toBeGreaterThan(0);
        expect(birinci.hamMs!).toBeLessThan(5000);

        // Rematch: same room and code, readiness reset, fresh board.
        cocuk.gonder({ t: "bir_el_daha" });
        const yeniden = await anne.bekle((o) => o.asama === "bekleme");
        expect(yeniden.kod).toBe(kod);
        expect(yeniden.oyuncular.map((p) => p.hazir)).toEqual([false, true]);

        anne.ws.close();
        cocuk.ws.close();
    });

    it("profil geçmişi turu gösterir; şifreler veritabanında ve günlükte düz metin değildir", async () => {
        const profil = await istek("/profil", undefined, cerez.cocuk);
        const html = await profil.text();
        expect(html).toContain("Oyun geçmişin");
        expect(html).toContain("Sayı Avı");
        expect(html).toContain("2.");

        const db = new Database(DB, { readonly: true });
        expect((db.prepare("SELECT COUNT(*) AS n FROM aile_sonuclari").get() as { n: number }).n).toBe(2);
        db.close();
        const ham = Buffer.concat(
            [DB, `${DB}-wal`].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f))
        ).toString("utf8");
        for (const sifre of Object.values(SIFRELER)) {
            expect(ham).not.toContain(sifre);
            expect(gunluk).not.toContain(sifre);
        }
    });

    it("sunucu yeniden başlayınca hesaplar kalır, yarıdaki tur kazanılmış sayılmaz", async () => {
        const { kod } = (await (await istek("/api/aile/oda", { oyun: "sayi-avi" }, cerez.anne)).json()) as { kod: string };
        const anne = new Istemci(kod, cerez.anne);
        const cocuk = new Istemci(kod, cerez.cocuk);
        await Promise.all([anne.acildi, cocuk.acildi]);
        anne.gonder({ t: "hazir", deger: true });
        cocuk.gonder({ t: "hazir", deger: true });
        await anne.bekle((o) => o.oyuncular.length === 2 && o.oyuncular.every((p) => p.hazir));
        anne.gonder({ t: "baslat" });
        const tur = (await anne.bekle((o) => o.asama === "geri_sayim")).tur!;
        await new Promise((r) => setTimeout(r, Math.max(0, tur.baslangic - Date.now()) + 300));
        for (let n = 1; n <= 25; n++) anne.dokun(tur.id, n);
        await new Promise((r) => setTimeout(r, 300));

        await sunucuyuKapat();
        await sunucuyuAc();

        const giris = await istek("/api/aile/giris", { kullaniciAdi: "Anne", sifre: SIFRELER.anne });
        expect(giris.status).toBe(200);
        const yeniCerez = cerezAl(giris);
        const donen = new Istemci(kod, yeniCerez);
        await new Promise((r) => donen.ws.once("close", r));
        expect(donen.mesajlar).toEqual([{ t: "katilamadi", kod: "kesildi" }]);

        const db = new Database(DB, { readonly: true });
        expect(db.prepare("SELECT durum FROM aile_turlari WHERE id = ?").get(tur.id)).toEqual({ durum: "kesildi" });
        expect((db.prepare("SELECT COUNT(*) AS n FROM aile_sonuclari WHERE tur_id = ?").get(tur.id) as { n: number }).n).toBe(0);
        db.close();
    });
});
