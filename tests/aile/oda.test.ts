import { describe, expect, it } from "vitest";
import { Oda, type KesinSonuc, type KesinToplam, type OdaCevresi, type OturumKaydi, type TurKaydi } from "@/lib/aile/oda";
import { AILE_OYUNLARI, oyunSirasiSec, TUM_OYUNLAR } from "@/lib/aile/oyunlar";
import { hafizaKartlari, type HafizaIstemciDurumu } from "@/lib/aile/oyunlar/hafiza-kartlari";
import { buyukHangisi, kutuSay, renkTuzagi } from "@/lib/aile/oyunlar/soru-oyunlari";
import { sayiAvi, type SayiAviDurumu } from "@/lib/aile/oyunlar/sayi-avi";
import {
    ARA_MS,
    GERI_SAYIM_MS,
    HAREKETSIZ_ODA_MS,
    KOPMA_PENCERESI_MS,
    type BenimTurum,
    type OdaGorunumu,
    type OyunKimligi,
    type SunucuMesaji,
} from "@/lib/aile/tipler";

// Session rules from spec sections 5–6 and the "oturum" change, driven by a
// fake clock. Most tests draw only Sayı Avı so every round is predictable.

const beklenen = (ben: BenimTurum | null | undefined) => (ben?.durum as SayiAviDurumu).beklenen;

/** mulberry32: small, seeded and even in its low bits. */
function tohumluRastgele(tohum: number) {
    let s = tohum >>> 0;
    return (n: number) => {
        s = (s + 0x6d2b79f5) >>> 0;
        let z = s;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return Math.floor((((z ^ (z >>> 14)) >>> 0) / 2 ** 32) * n);
    };
}

function kur(tohum = 1, oyunHavuzu: readonly OyunKimligi[] = ["sayi-avi"]) {
    const mesajlar = new Map<string, SunucuMesaji[]>();
    const baslayan: TurKaydi[] = [];
    const biten: { turId: string; sonuclar: KesinSonuc[] }[] = [];
    const kesilen: string[] = [];
    const kapanan: string[] = [];
    const oturumlar: OturumKaydi[] = [];
    const bitenOturumlar: { oturumId: string; toplamlar: KesinToplam[] }[] = [];
    const kesilenOturumlar: string[] = [];
    let idSayaci = 0;
    const cevre: OdaCevresi = {
        gonder: (b, m) => mesajlar.set(b, [...(mesajlar.get(b) ?? []), m]),
        oturumBasladi: (o) => oturumlar.push(o),
        oturumBitti: (oturumId, toplamlar) => bitenOturumlar.push({ oturumId, toplamlar }),
        oturumKesildi: (o) => kesilenOturumlar.push(o),
        oyunHavuzu,
        turBasladi: (t) => baslayan.push(t),
        turBitti: (turId, sonuclar) => biten.push({ turId, sonuclar }),
        turKesildi: (t) => kesilen.push(t),
        odaKapandi: (k) => kapanan.push(k),
        rastgele: tohumluRastgele(tohum),
        yeniId: () => `id-${++idSayaci}`,
    };
    let simdi = 1_000_000;
    const oda = new Oda("ABCDEF", null, kisi("a"), simdi, cevre);
    const sira = new Map<string, number>();
    const t = {
        oda,
        mesajlar,
        baslayan,
        biten,
        kesilen,
        kapanan,
        oturumlar,
        bitenOturumlar,
        kesilenOturumlar,
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
        /** From a round's results straight into the next round's play. */
        sonrakiTur() {
            expect(oda.asama).toBe("tur_sonucu");
            t.ilerle(ARA_MS);
            expect(oda.asama).toBe("geri_sayim");
            t.ilerle(GERI_SAYIM_MS);
            expect(oda.asama).toBe("oynaniyor");
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

    it("oturum sürerken yeni oyuncu alınmaz, oyunlar arasındaki arada da", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        expect(t.baglan("c")).toEqual({ ok: false, hata: "tur_suruyor" });
        t.ilerle(GERI_SAYIM_MS);
        expect(t.baglan("c")).toEqual({ ok: false, hata: "tur_suruyor" });
        t.bitir("a");
        t.bitir("b");
        expect(t.oda.asama).toBe("tur_sonucu");
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
        expect([...(ta.icerik as number[])].sort((x, y) => x - y)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        expect(ta.baslangic).toBe(t.simdi + GERI_SAYIM_MS);
        expect(ta.bitis).toBe(ta.baslangic + 90_000);
        expect(ta.kuralSurumu).toBe("sayi-avi@1");
    });

    it("geri sayımda kopan oyuncu turdan düşmez; dönmezse koptu sayılır", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.hazirla("a", "b");
        t.oda.baslat("a", t.simdi);
        t.oda.kop("b", "b", t.simdi + 500);
        expect(t.oda.asama).toBe("geri_sayim");
        t.ilerle(GERI_SAYIM_MS);
        expect(t.oda.asama).toBe("oynaniyor");
        t.ilerle(KOPMA_PENCERESI_MS);
        t.bitir("a");
        expect(t.biten[0].sonuclar.find((s) => s.id === "b")).toMatchObject({ durum: "koptu", turPuani: 0 });
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
        expect(beklenen(yanit.ben)).toBe(2);
        t.oda.hamle("a", turId, 0.5, 2, t.simdi);
        t.oda.hamle("a", turId, -3, 2, t.simdi);
        expect(beklenen(t.gorunum("a").tur!.ben)).toBe(2);
    });

    it("yanlış dokunuş 2 sn ceza ekler, bulunmuş sayıya dokunmak ceza değildir", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.dokun("a", 1);
        t.dokun("a", 1);
        t.dokun("a", 7);
        expect(t.gorunum("a").tur!.ben).toMatchObject({ durum: { beklenen: 2 }, hatalar: 1 });
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
        expect(t.oda.asama).toBe("tur_sonucu");
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
        expect(t.oda.asama).toBe("tur_sonucu");
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
        expect(t.oda.asama).toBe("tur_sonucu");
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
        expect(ben).toMatchObject({ durum: { beklenen: 6 }, sonSira: 5, disarida: null });
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
        expect(t.oda.asama).toBe("tur_sonucu");
        expect(t.biten[0].sonuclar.find((s) => s.id === "c")).toMatchObject({ durum: "koptu", sira: 3 });
        // Returning later does not reopen the finished round; c plays the next one.
        expect(t.baglan("c", "c-2").ok).toBe(true);
        expect(t.biten).toHaveLength(1);
        t.sonrakiTur();
        expect(t.gorunum("c").tur!.ben).not.toBeNull();
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

    it("herkes koparsa oturum kapanır, süren tur tamamlanmış sayılmaz", () => {
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
        expect(t.kesilenOturumlar).toEqual([t.oturumlar[0].id]);
        expect(t.bitenOturumlar).toHaveLength(0);
    });

    it("oturumu açan hiç bağlanmazsa oturum kapanır", () => {
        const t = kur();
        t.ilerle(KOPMA_PENCERESI_MS);
        expect(t.oda.kapali).toBe(true);
    });

    it("30 dk hareketsiz bekleyen oturum kapanır", () => {
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


describe("Sayı Avı kuralları", () => {
    it("geçersiz değerleri reddeder", () => {
        const d = sayiAvi.baslangicDurumu([]);
        for (const deger of [0, 26, 1.5, NaN]) {
            expect(sayiAvi.hamleUygula(d, deger, 0, []).kabul).toBe(false);
        }
    });
});

describe("oturum akışı", () => {
    it("5 oyun sırayla oynanır; her oyunda sıraya göre puan, sonda toplam sıralama yazılır", () => {
        const t = kur();
        for (const id of ["a", "b", "c"]) t.baglan(id);
        t.baslatVeOyna("a", "b", "c");
        expect(t.oturumlar).toHaveLength(1);
        expect(t.oturumlar[0].oyunlar).toEqual(Array(5).fill("sayi-avi"));

        for (let tur = 0; tur < 5; tur++) {
            expect(t.gorunum("a").oyunNo).toBe(tur);
            // a wins every game; b and c swap second place.
            t.bitir("a");
            t.ilerle(10);
            t.bitir(tur % 2 === 0 ? "b" : "c");
            t.ilerle(10);
            t.bitir(tur % 2 === 0 ? "c" : "b");
            if (tur < 4) {
                expect(t.gorunum("a").araBitis).toBe(t.simdi + ARA_MS);
                t.sonrakiTur();
            }
        }
        expect(t.oda.asama).toBe("bitti");
        expect(t.biten).toHaveLength(5);
        expect(t.biten[0].sonuclar.map((s) => [s.id, s.turPuani])).toEqual([["a", 3], ["b", 2], ["c", 1]]);
        // b: 2+1+2+1+2 = 8, c: 1+2+1+2+1 = 7.
        const toplamlar = t.gorunum("b").toplamlar;
        expect(toplamlar.map((x) => [x.id, x.sira, x.puan])).toEqual([["a", 1, 15], ["b", 2, 8], ["c", 3, 7]]);
        expect(t.bitenOturumlar).toEqual([
            { oturumId: t.oturumlar[0].id, toplamlar: toplamlar.map((x) => ({ ...x, oyuncuSayisi: 3 })) },
        ]);
        // Every round row carries its session and place in it.
        expect(t.baslayan.map((r) => [r.oturumId, r.oturumSirasi])).toEqual(
            [0, 1, 2, 3, 4].map((i) => [t.oturumlar[0].id, i])
        );
    });

    it("tam havuzla beş farklı oyun gelir ve süre dolunca her biri kendiliğinden biter", () => {
        const t = kur(7, TUM_OYUNLAR);
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        for (let i = 0; i < 5; i++) {
            t.ilerle(AILE_OYUNLARI[t.baslayan[i].oyun].sureMs);
            if (i < 4) t.sonrakiTur();
        }
        expect(t.oda.asama).toBe("bitti");
        expect(new Set(t.baslayan.map((r) => r.oyun))).toEqual(new Set(TUM_OYUNLAR));
        expect(t.baslayan.map((r) => r.oyun)).toEqual(t.oturumlar[0].oyunlar);
        // Nobody moved: everyone shares first place in every game.
        expect(t.gorunum("a").toplamlar.map((x) => [x.sira, x.puan])).toEqual([[1, 10], [1, 10]]);
        // Points games count everyone still present as done when time runs out.
        const puanli = t.biten.filter((_, i) => AILE_OYUNLARI[t.baslayan[i].oyun].puanli);
        expect(puanli.flatMap((b) => b.sonuclar.map((s) => s.durum))).toEqual(Array(6).fill("bitirdi"));
    });

    it("yalnızca sahip aradan hemen sonraki oyuna geçirebilir", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        expect(t.oda.devam("a", t.simdi)).toBe("gecersiz_asama");
        t.bitir("a");
        t.bitir("b");
        expect(t.oda.devam("b", t.simdi)).toBe("yetki_yok");
        expect(t.oda.devam("a", t.simdi)).toBeNull();
        expect(t.oda.asama).toBe("geri_sayim");
        expect(t.gorunum("b").oyunNo).toBe(1);
    });

    it("uzun kopan oyuncu o oyunda puan alamaz, dönünce sonraki oyuna katılır", () => {
        const t = kur();
        for (const id of ["a", "b", "c"]) t.baglan(id);
        t.baslatVeOyna("a", "b", "c");
        t.bitir("c");
        t.bitir("a");
        t.bitir("b");
        t.oda.kop("c", "c", t.simdi);
        t.ilerle(ARA_MS);
        // The next game started while c was briefly away; c still has a seat in it.
        expect(t.gorunum("a").tur!.ilerlemeler.map((i) => i.id)).toEqual(["a", "b", "c"]);
        t.ilerle(KOPMA_PENCERESI_MS);
        t.bitir("a");
        t.bitir("b");
        expect(t.biten[1].sonuclar.find((s) => s.id === "c")).toMatchObject({ durum: "koptu", turPuani: 0 });
        // While c is away the totals show it, and the next game goes on without c.
        t.ilerle(1);
        expect(t.gorunum("a").toplamlar.find((x) => x.id === "c")).toMatchObject({ puan: 3, ayrildi: true });
        t.sonrakiTur();
        expect(t.gorunum("a").tur!.ilerlemeler.map((i) => i.id)).toEqual(["a", "b"]);
        // c is back: a newcomer could not join now, but c's seat in the session is kept.
        expect(t.baglan("d")).toEqual({ ok: false, hata: "tur_suruyor" });
        expect(t.baglan("c", "c-geri").ok).toBe(true);
        t.bitir("a");
        t.bitir("b");
        t.sonrakiTur();
        expect(t.gorunum("a").tur!.ilerlemeler.map((i) => i.id)).toEqual(["a", "b", "c"]);
        expect(t.gorunum("a").toplamlar.find((x) => x.id === "c")).toMatchObject({ ayrildi: false });
    });

    it("ayrılan oyuncunun puanı kalır; herkes ayrılırsa kalan izleyicilerle oturum biter", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        t.bitir("b");
        t.bitir("a");
        // A latecomer would only watch, so nobody new may take part mid-session.
        t.oda.ayril("a", t.simdi);
        t.oda.ayril("b", t.simdi);
        expect(t.oda.kapali).toBe(true);
        expect(t.kesilenOturumlar).toHaveLength(1);
    });

    it("oturum bitince aynı ekiple yeni oturum açılır ve yeni oyuncu katılabilir", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        for (let i = 0; i < 5; i++) {
            t.bitir("a");
            t.bitir("b");
            if (i < 4) t.sonrakiTur();
        }
        expect(t.oda.asama).toBe("bitti");
        expect(t.oda.hazir("a", true, t.simdi)).toBe("gecersiz_asama");
        expect(t.baglan("c").ok).toBe(true);

        expect(t.oda.yeniOturum("b", t.simdi)).toBeNull();
        const g = t.gorunum("a");
        expect(g.asama).toBe("bekleme");
        expect(g.turSonuclari).toBeNull();
        expect(g.oyunlar).toBeNull();
        expect(g.toplamlar).toEqual([]);
        expect(g.oyuncular.map((o) => [o.id, o.hazir])).toEqual([["a", false], ["b", true], ["c", false]]);
        t.hazirla("a", "c");
        expect(t.oda.baslat("a", t.simdi)).toBeNull();
        expect(t.oturumlar).toHaveLength(2);
        expect(t.oturumlar[1].id).not.toBe(t.oturumlar[0].id);
    });

    it("bitti ekranı da 30 dk hareketsiz kalırsa kapanır; tamamlanan oturum kesildi sayılmaz", () => {
        const t = kur();
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        for (let i = 0; i < 5; i++) {
            t.bitir("a");
            t.bitir("b");
            if (i < 4) t.sonrakiTur();
        }
        t.ilerle(HAREKETSIZ_ODA_MS);
        expect(t.oda.kapali).toBe(true);
        expect(t.kesilenOturumlar).toHaveLength(0);
        expect(t.bitenOturumlar).toHaveLength(1);
    });
});

describe("oyun sırası", () => {
    it("havuz yeterliyse tekrar etmez; küçükse tekrar eder ama art arda gelmez", () => {
        for (let tohum = 1; tohum < 50; tohum++) {
            const r = tohumluRastgele(tohum);
            const bes = oyunSirasiSec(TUM_OYUNLAR, 5, r);
            expect(new Set(bes).size).toBe(5);
            const iki = oyunSirasiSec(["sayi-avi", "kutu-say"], 5, r);
            expect(iki).toHaveLength(5);
            for (let i = 1; i < iki.length; i++) expect(iki[i]).not.toBe(iki[i - 1]);
            expect(oyunSirasiSec(["sayi-avi"], 5, r)).toEqual(Array(5).fill("sayi-avi"));
        }
    });
});

describe("Hafıza Kartları kuralları", () => {
    const kartlar = [0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7, 6, 7];
    const oyna = (hamleler: number[]) => {
        let d = hafizaKartlari.baslangicDurumu(kartlar);
        let zaman = 0;
        for (const h of hamleler) d = hafizaKartlari.hamleUygula(d, h, (zaman += 100), kartlar).durum;
        return d;
    };

    it("eşleşen çift açık kalır, eşleşmeyen bir sonraki dokunuşta kapanır", () => {
        let d = oyna([0, 1]);
        expect(d).toMatchObject({ eslesen: [], acik: [0, 1], hamle: 1 });
        d = oyna([0, 1, 2]);
        expect(d).toMatchObject({ acik: [2], hamle: 1 });
        d = oyna([0, 1, 0, 2]);
        expect(d).toMatchObject({ eslesen: [0, 2], acik: [], hamle: 2 });
        expect(hafizaKartlari.hamleUygula(d, 0, 0, kartlar).kabul).toBe(false);
        expect(hafizaKartlari.hamleUygula(d, 16, 0, kartlar).kabul).toBe(false);
    });

    it("8 çift bulunca biter; az hamle kazanır, eşitse hızlı olan", () => {
        const kusursuz = oyna([0, 2, 1, 3, 4, 6, 5, 7, 8, 10, 9, 11, 12, 14, 13, 15]);
        expect(hafizaKartlari.ozet(kusursuz)).toMatchObject({ bitti: true, puan: 8, ilerleme: 8, hatalar: 0, nihaiMs: 1600 });
        const hatali = oyna([0, 1, 0, 2, 1, 3, 4, 6, 5, 7, 8, 10, 9, 11, 12, 14, 13, 15]);
        expect(hafizaKartlari.ozet(hatali)).toMatchObject({ bitti: true, puan: 9, hatalar: 1 });
        expect(hafizaKartlari.karsilastir(kusursuz, hatali)).toBeLessThan(0);
        const yarim = oyna([0, 2]);
        expect(hafizaKartlari.karsilastir(hatali, yarim)).toBeLessThan(0);
    });

    it("kart yüzleri sayfaya yalnızca açılınca gider", () => {
        const t = kur(3, ["hafiza-kartlari"]);
        t.baglan("a");
        t.baglan("b");
        t.baslatVeOyna("a", "b");
        const tur = t.gorunum("a").tur!;
        expect(tur.icerik).toEqual({ kartSayisi: 16 });
        expect((tur.ben!.durum as HafizaIstemciDurumu).gorunen).toEqual(Array(16).fill(null));
        t.dokun("a", 5);
        const yanit = t.mesajlar.get("a")!.at(-1) as Extract<SunucuMesaji, { t: "hamle_sonucu" }>;
        const gorunen = (yanit.ben.durum as HafizaIstemciDurumu).gorunen;
        expect(gorunen.filter((g) => g !== null)).toHaveLength(1);
        expect(gorunen[5]).not.toBeNull();
        // Another player's view never shows what a turned over.
        expect((t.gorunum("b").tur!.ben!.durum as HafizaIstemciDurumu).gorunen).toEqual(Array(16).fill(null));
    });
});

describe("soru oyunları", () => {
    it("doğru +1, yanlış −1; puan sıfırın altına düşmez; geçersiz yanıt sayılmaz", () => {
        const sorular = buyukHangisi.icerikUret(tohumluRastgele(5));
        let d = buyukHangisi.baslangicDurumu(sorular);
        const dogru = (i: number) => (sorular[i].sayilar[0] > sorular[i].sayilar[1] ? 0 : 1);
        d = buyukHangisi.hamleUygula(d, 1 - dogru(0), 100, sorular).durum;
        expect(d).toMatchObject({ soru: 1, puan: 0, yanlis: 1 });
        d = buyukHangisi.hamleUygula(d, dogru(1), 200, sorular).durum;
        d = buyukHangisi.hamleUygula(d, dogru(2), 300, sorular).durum;
        d = buyukHangisi.hamleUygula(d, 1 - dogru(3), 400, sorular).durum;
        expect(d).toMatchObject({ soru: 4, puan: 1, dogru: 2, yanlis: 2 });
        for (const deger of [2, -1, 0.5]) expect(buyukHangisi.hamleUygula(d, deger, 500, sorular).kabul).toBe(false);
        expect(buyukHangisi.karsilastir({ ...d, puan: 3 }, { ...d, puan: 3, yanlis: 9 })).toBe(0);
    });

    it("üretilen sorular çözülebilir", () => {
        const r = tohumluRastgele(11);
        for (const s of buyukHangisi.icerikUret(r)) expect(s.sayilar[0]).not.toBe(s.sayilar[1]);
        const renkler = renkTuzagi.icerikUret(r);
        for (let i = 1; i < renkler.length; i++) expect(renkler[i].renk).not.toBe(renkler[i - 1].renk);
        expect(renkler.filter((s) => s.kelime !== s.renk).length).toBeGreaterThan(renkler.length / 2);
        for (const s of kutuSay.icerikUret(r)) {
            expect(s.secenekler).toContain(s.kutular.length);
            expect(new Set(s.kutular).size).toBe(s.kutular.length);
        }
    });
});
