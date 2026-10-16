import { describe, expect, it } from "vitest";
import { Oda, type KesinSonuc, type OdaCevresi, type TurKaydi } from "@/lib/aile/oda";
import { sayiAvi } from "@/lib/aile/oyunlar/sayi-avi";
import {
    GERI_SAYIM_MS,
    HAREKETSIZ_ODA_MS,
    KOPMA_PENCERESI_MS,
    type OdaGorunumu,
    type SunucuMesaji,
} from "@/lib/aile/tipler";

// Room rules from spec sections 5–6, driven by a fake clock.

function tohumluRastgele(tohum: number) {
    let s = tohum;
    return (n: number) => {
        s = (s * 1103515245 + 12345) % 2 ** 31;
        return s % n;
    };
}

function kur(tohum = 1) {
    const mesajlar = new Map<string, SunucuMesaji[]>();
    const baslayan: TurKaydi[] = [];
    const biten: { turId: string; sonuclar: KesinSonuc[] }[] = [];
    const kesilen: string[] = [];
    const kapanan: string[] = [];
    let idSayaci = 0;
    const cevre: OdaCevresi = {
        gonder: (b, m) => mesajlar.set(b, [...(mesajlar.get(b) ?? []), m]),
        turBasladi: (t) => baslayan.push(t),
        turBitti: (turId, sonuclar) => biten.push({ turId, sonuclar }),
        turKesildi: (t) => kesilen.push(t),
        odaKapandi: (k) => kapanan.push(k),
        rastgele: tohumluRastgele(tohum),
        yeniId: () => `tur-${++idSayaci}`,
    };
    let simdi = 1_000_000;
    const oda = new Oda("ABCDEF", "sayi-avi", null, kisi("a"), simdi, cevre);
    const sira = new Map<string, number>();
    const t = {
        oda,
        mesajlar,
        baslayan,
        biten,
        kesilen,
        kapanan,
        get simdi() {
            return simdi;
        },
        ilerle(ms: number) {
            simdi += ms;
            oda.ilerlet(simdi);
        },
        baglan(id: string, baglanti = id) {
            return oda.baglan(kisi(id), baglanti, simdi);
        },
        son(baglanti: string) {
            return [...(mesajlar.get(baglanti) ?? [])].reverse().find((m) => m.t === "durum") as
                | { t: "durum"; oda: OdaGorunumu }
                | undefined;
        },
        gorunum(id: string) {
            return oda.gorunum(id);
        },
        hazirla(...idler: string[]) {
            for (const id of idler) expect(oda.hazir(id, true, simdi)).toBeNull();
        },
        baslatVeOyna(sahip: string, ...digerleri: string[]) {
            t.hazirla(sahip, ...digerleri);
            expect(oda.baslat(sahip, simdi)).toBeNull();
            t.ilerle(GERI_SAYIM_MS);
            expect(oda.asama).toBe("oynaniyor");
        },
        dokun(id: string, deger: number) {
            const s = (sira.get(id) ?? 0) + 1;
            sira.set(id, s);
            oda.hamle(id, oda.gorunum(id).tur?.id, s, deger, simdi);
        },
        bitir(id: string, hatalar = 0) {
            for (let i = 0; i < hatalar; i++) t.dokun(id, 25);
            for (let n = 1; n <= 25; n++) t.dokun(id, n);
        },
    };
    return t;
}

function kisi(id: string) {
    return { id, ad: id.toUpperCase(), renk: "#D9EBDB" };
}

describe("katılım", () => {
    it("2, 4 ve 8 oyuncuyu alır, 9. oyuncuya dolu der", () => {
        const t = kur();
        t.baglan("a");
        for (let i = 2; i <= 8; i++) {
            expect(t.baglan(`o${i}`).ok).toBe(true);
            if (i === 2 || i === 4) expect(t.oda.oyuncuSayisi).toBe(i);
        }
        expect(t.oda.oyuncuSayisi).toBe(8);
        expect(t.baglan("o9")).toEqual({ ok: false, hata: "dolu" });
    });

    it("aynı hesap ikinci sekmeden yeni oyuncu olmaz, koltuğunu devralır", () => {
        const t = kur();
        t.baglan("a", "a-1");
        t.baglan("b");
        expect(t.baglan("b", "b-2")).toEqual({ ok: true, oncekiBaglanti: "b" });
        expect(t.oda.oyuncuSayisi).toBe(2);
        // The old tab's late close does not disconnect the new one.
        t.oda.kop("b", "b", t.simdi);
        expect(t.gorunum("a").oyuncular.find((o) => o.id === "b")?.bagli).toBe(true);
    });

    it("tur sürerken yeni oyuncu alınmaz", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        expect(t.baglan("c")).toEqual({ ok: false, hata: "tur_suruyor" });
        t.ilerle(GERI_SAYIM_MS);
        expect(t.baglan("c")).toEqual({ ok: false, hata: "tur_suruyor" });
    });
});

describe("başlatma", () => {
    it("yalnızca sahip, en az 2 bağlı ve herkes hazırken başlatır", () => {
        const t = kur();
        t.baglan("a");
        expect(t.oda.baslat("a", t.simdi)).toBe("az_oyuncu");
        t.baglan("b");
        t.baglan("c");
        t.hazirla("a", "b");
        expect(t.oda.baslat("b", t.simdi)).toBe("yetki_yok");
        expect(t.oda.baslat("x", t.simdi)).toBe("yetki_yok");
        expect(t.oda.baslat("a", t.simdi)).toBe("hazir_degil");
        t.hazirla("c");
        expect(t.oda.baslat("a", t.simdi)).toBeNull();
        expect(t.oda.asama).toBe("geri_sayim");
    });

    it("herkese aynı tur kimliği, içerik ve ortak başlangıç gider", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        const ta = t.son("a")!.oda.tur!;
        const tb = t.son("b")!.oda.tur!;
        expect(ta.id).toBe(tb.id);
        expect(ta.icerik).toEqual(tb.icerik);
        expect([...ta.icerik].sort((x, y) => x - y)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        expect(ta.baslangic).toBe(t.simdi + GERI_SAYIM_MS);
        expect(ta.bitis).toBe(ta.baslangic + 90_000);
        expect(ta.kuralSurumu).toBe("sayi-avi@1");
    });

    it("geri sayımda kopma turu iptal eder ve hazırları sıfırlar", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        t.oda.kop("b", "b", t.simdi + 500);
        expect(t.oda.asama).toBe("bekleme");
        expect(t.gorunum("a").oyuncular.every((o) => !o.hazir)).toBe(true);
        t.ilerle(GERI_SAYIM_MS);
        expect(t.baslayan).toHaveLength(0);
    });

    it("oyun değiştirmek hazırları sıfırlar ve yalnızca sahibe açıktır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        expect(t.oda.oyunDegistir("b", "sayi-avi", t.simdi)).toBe("yetki_yok");
        expect(t.oda.oyunDegistir("a", "yilan", t.simdi)).toBe("gecersiz_oyun");
        expect(t.oda.oyunDegistir("a", "sayi-avi", t.simdi)).toBeNull();
        expect(t.gorunum("a").oyuncular.some((o) => o.hazir)).toBe(false);
        expect(t.oda.baslat("a", t.simdi)).toBe("hazir_degil");
    });
});

describe("Sayı Avı turu", () => {
    it("başlangıçtan önce, yanlış tur kimliğiyle veya tekrar sırayla gelen hamleyi reddeder", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        const turId = t.gorunum("a").tur!.id;
        t.oda.hamle("a", turId, 1, 1, t.simdi + 100);
        let yanit = t.mesajlar.get("a")!.at(-1) as Extract<SunucuMesaji, { t: "hamle_sonucu" }>;
        expect(yanit.kabul).toBe(false);

        t.ilerle(GERI_SAYIM_MS);
        t.oda.hamle("a", "baska-tur", 1, 1, t.simdi);
        expect(t.mesajlar.get("a")!.at(-1)!.t).not.toBe("hamle_sonucu");
        t.oda.hamle("a", turId, 1, 1, t.simdi);
        t.oda.hamle("a", turId, 1, 2, t.simdi);
        yanit = t.mesajlar.get("a")!.at(-1) as Extract<SunucuMesaji, { t: "hamle_sonucu" }>;
        expect(yanit.kabul).toBe(false);
        expect(yanit.ben.beklenen).toBe(2);
        t.oda.hamle("a", turId, 0.5, 2, t.simdi);
        t.oda.hamle("a", turId, -3, 2, t.simdi);
        expect(t.gorunum("a").tur!.ben!.beklenen).toBe(2);
    });

    it("yanlış dokunuş 2 sn ceza ekler, bulunmuş sayıya dokunmak ceza değildir", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.dokun("a", 1);
        t.dokun("a", 1);
        t.dokun("a", 7);
        expect(t.gorunum("a").tur!.ben).toMatchObject({ beklenen: 2, hatalar: 1 });
    });

    it("bitiren sonucu kesinleşir, sonraki hamleleri kabul edilmez, sonuç tek kez yazılır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.ilerle(10_000);
        t.bitir("a", 1);
        expect(t.gorunum("a").tur!.ben).toMatchObject({ bitti: true, hamMs: 10_000, nihaiMs: 12_000 });
        t.dokun("a", 3);
        expect((t.mesajlar.get("a")!.at(-1) as { kabul: boolean }).kabul).toBe(false);

        t.ilerle(20_000);
        t.bitir("b");
        expect(t.oda.asama).toBe("sonuc");
        expect(t.biten).toHaveLength(1);
        expect(t.baslayan).toHaveLength(1);
        const [a, b] = t.biten[0].sonuclar;
        expect(a).toMatchObject({ id: "a", sira: 1, durum: "bitirdi", hamMs: 10_000, cezaMs: 2_000, nihaiMs: 12_000 });
        expect(b).toMatchObject({ id: "b", sira: 2, durum: "bitirdi", hamMs: 30_000, nihaiMs: 30_000 });

        // Late duplicates after the round closed change nothing.
        t.dokun("b", 25);
        t.ilerle(100_000);
        expect(t.biten).toHaveLength(1);
    });

    it("eşit sonuçlar ortak sıra alır: 1, 1, 3", () => {
        const t = kur();
        for (const id of ["a", "b", "c"]) t.baglan(id);
        t.baslatVeOyna("a", "b", "c");
        t.ilerle(15_000);
        t.bitir("a");
        t.bitir("b");
        t.ilerle(1);
        t.bitir("c");
        expect(t.biten[0].sonuclar.map((s) => [s.id, s.sira])).toEqual([
            ["a", 1],
            ["b", 1],
            ["c", 3],
        ]);
    });

    it("90 saniyede biter; bitiremeyenler ilerleme, sonra hata sayısıyla sıralanır", () => {
        const t = kur();
        for (const id of ["a", "b", "c", "d"]) t.baglan(id);
        t.baslatVeOyna("a", "b", "c", "d");
        for (let n = 1; n <= 10; n++) t.dokun("b", n);
        for (let n = 1; n <= 10; n++) t.dokun("c", n);
        t.dokun("c", 20);
        for (let n = 1; n <= 12; n++) t.dokun("d", n);
        t.ilerle(80_000);
        t.bitir("a", 6);
        t.ilerle(10_000);
        expect(t.oda.asama).toBe("sonuc");
        expect(t.biten[0].sonuclar.map((s) => [s.id, s.sira, s.durum])).toEqual([
            ["a", 1, "bitirdi"],
            ["d", 2, "bitiremedi"],
            ["b", 3, "bitiremedi"],
            ["c", 4, "bitiremedi"],
        ]);
        // A finisher's penalties may push the final time past 90 s; it still ranks first.
        expect(t.biten[0].sonuclar[0].nihaiMs).toBe(92_000);
    });

    it("tur sonu hamle gelmeden de sunucu saatine göre kapanır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.ilerle(89_999);
        expect(t.oda.asama).toBe("oynaniyor");
        t.ilerle(1);
        expect(t.oda.asama).toBe("sonuc");
    });
});

describe("kopma ve ayrılma", () => {
    it("20 sn içinde dönen oyuncu kaldığı yerden sürdürür", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        for (let n = 1; n <= 5; n++) t.dokun("b", n);
        t.oda.kop("b", "b", t.simdi);
        t.ilerle(KOPMA_PENCERESI_MS - 1);
        expect(t.baglan("b", "b-yeni").ok).toBe(true);
        const ben = t.son("b-yeni")!.oda.tur!.ben!;
        expect(ben).toMatchObject({ beklenen: 6, sonSira: 5, disarida: null });
    });

    it("20 sn'de dönmeyen oyuncu koptu sayılır, diğerleri bitirince tur kapanır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baglan("c");
        t.baslatVeOyna("a", "b", "c");
        for (let n = 1; n <= 20; n++) t.dokun("c", n);
        t.oda.kop("c", "c", t.simdi);
        t.ilerle(KOPMA_PENCERESI_MS);
        t.bitir("a");
        t.bitir("b");
        expect(t.oda.asama).toBe("sonuc");
        expect(t.biten[0].sonuclar.find((s) => s.id === "c")).toMatchObject({ durum: "koptu", sira: 3 });
        // Returning later does not reopen the finished round.
        expect(t.baglan("c", "c-2").ok).toBe(true);
        expect(t.biten).toHaveLength(1);
    });

    it("bitirdikten sonra kopan oyuncunun sonucu korunur", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.bitir("a");
        t.oda.kop("a", "a", t.simdi);
        t.ilerle(KOPMA_PENCERESI_MS + 1000);
        t.bitir("b");
        expect(t.biten[0].sonuclar[0]).toMatchObject({ id: "a", durum: "bitirdi", sira: 1 });
    });

    it("tur içinde ayrılan bitirenleri geçemez", () => {
        const t = kur();
        for (const id of ["a", "b", "c"]) t.baglan(id);
        t.baslatVeOyna("a", "b", "c");
        for (let n = 1; n <= 24; n++) t.dokun("c", n);
        t.oda.ayril("c", t.simdi);
        expect(t.mesajlar.get("c")!.at(-1)).toEqual({ t: "kapandi", sebep: "ayrildin" });
        t.ilerle(30_000);
        t.bitir("a");
        for (let n = 1; n <= 3; n++) t.dokun("b", n);
        t.ilerle(60_000);
        expect(t.biten[0].sonuclar.map((s) => [s.id, s.sira, s.durum])).toEqual([
            ["a", 1, "bitirdi"],
            ["b", 2, "bitiremedi"],
            ["c", 3, "ayrildi"],
        ]);
    });

    it("sahip açıkça ayrılınca en önce katılan bağlı oyuncu hemen sahip olur", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baglan("c");
        t.oda.ayril("a", t.simdi);
        expect(t.gorunum("b").sahipId).toBe("b");
    });

    it("sahip koparsa 20 sn sonra sahiplik devredilir", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.oda.kop("a", "a", t.simdi);
        t.ilerle(KOPMA_PENCERESI_MS - 1);
        expect(t.gorunum("b").sahipId).toBe("a");
        t.ilerle(1);
        expect(t.gorunum("b").sahipId).toBe("b");
        expect(t.oda.oyuncuSayisi).toBe(1);
    });

    it("herkes koparsa oda kapanır, süren tur tamamlanmış sayılmaz", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.bitir("a");
        t.oda.kop("a", "a", t.simdi);
        t.oda.kop("b", "b", t.simdi);
        t.ilerle(KOPMA_PENCERESI_MS);
        expect(t.oda.kapali).toBe(true);
        expect(t.kapanan).toEqual(["ABCDEF"]);
        expect(t.biten).toHaveLength(0);
        expect(t.kesilen).toHaveLength(1);
    });

    it("oda kurucusu hiç bağlanmazsa oda kapanır", () => {
        const t = kur();
        t.ilerle(KOPMA_PENCERESI_MS);
        expect(t.oda.kapali).toBe(true);
    });

    it("30 dk hareketsiz bekleme odası kapanır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.ilerle(HAREKETSIZ_ODA_MS - 1);
        expect(t.oda.kapali).toBe(false);
        t.ilerle(1);
        expect(t.oda.kapali).toBe(true);
        expect(t.mesajlar.get("a")!.at(-1)).toEqual({ t: "kapandi", sebep: "oda_kapandi" });
    });
});

describe("bir el daha", () => {
    it("aynı odada yeni tahta üretir ve hazırları sıfırlar", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        const ilkTur = t.gorunum("a").tur!;
        t.bitir("a");
        t.bitir("b");
        expect(t.oda.asama).toBe("sonuc");
        expect(t.oda.hazir("a", true, t.simdi)).toBe("gecersiz_asama");

        expect(t.oda.birElDaha("b", t.simdi)).toBeNull();
        const g = t.gorunum("a");
        expect(g.asama).toBe("bekleme");
        expect(g.sonuclar).toBeNull();
        expect(g.oyuncular.map((o) => [o.id, o.hazir])).toEqual([
            ["a", false],
            ["b", true],
        ]);
        t.hazirla("a");
        expect(t.oda.baslat("a", t.simdi)).toBeNull();
        const yeni = t.gorunum("a").tur!;
        expect(yeni.id).not.toBe(ilkTur.id);
        expect(yeni.icerik).not.toEqual(ilkTur.icerik);
    });
});

describe("Sayı Avı kuralları", () => {
    it("geçersiz değerleri reddeder", () => {
        const d = sayiAvi.baslangicDurumu([]);
        for (const deger of [0, 26, 1.5, NaN]) {
            expect(sayiAvi.hamleUygula(d, deger, 0, []).kabul).toBe(false);
        }
    });
});
