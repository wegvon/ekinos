import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
    geciciSifreAta,
    girisYap,
    kayitOl,
    kullaniciAdiNormalize,
    oturumAc,
    oturumKapat,
    oturumKullanicisi,
    sifreDegistir,
} from "@/lib/server/auth";
import { getDb, setDb, veritabaniAc } from "@/lib/server/db";
import { aileDeposu } from "@/lib/aile/depo";
import { kaynakGecerli, OranSiniri } from "@/lib/server/guvenlik";

beforeEach(() => {
    setDb(veritabaniAc(":memory:"));
});

describe("kayıt", () => {
    it("e-postasız hesap açar ve şifreyi düz metin saklamaz", async () => {
        const sonuc = await kayitOl("Ayşe_1", "gizli-sifre");
        expect(sonuc.ok).toBe(true);
        const satir = getDb().prepare("SELECT * FROM kullanicilar").get() as Record<string, unknown>;
        expect(satir.kullanici_adi).toBe("Ayşe_1");
        expect(String(satir.sifre_hash)).toMatch(/^\$argon2id\$/);
        expect(JSON.stringify(satir)).not.toContain("gizli-sifre");
    });

    it("aynı kullanıcı adına (büyük/küçük harf ve Türkçe İ dahil) ikinci hesap açılmaz", async () => {
        expect((await kayitOl("İlker", "12345678")).ok).toBe(true);
        expect(await kayitOl("ilker", "12345678")).toEqual({ ok: false, hata: "Bu kullanıcı adı alınmış." });
        expect(await kayitOl("İLKER", "12345678")).toMatchObject({ ok: false });
        expect(kullaniciAdiNormalize("IŞIK")).toBe("ışık");
    });

    it("kullanıcı adı ve şifre kurallarını uygular, sessizce kırpmaz", async () => {
        for (const ad of ["ab", "a".repeat(21), "boş luk", "<b>x</b>", 42]) {
            expect((await kayitOl(ad, "12345678")).ok).toBe(false);
        }
        expect((await kayitOl("deniz", "1234567")).ok).toBe(false);
        expect((await kayitOl("deniz", "x".repeat(129))).ok).toBe(false);
        expect((await kayitOl("deniz", "  Boşluk Önemli ")).ok).toBe(true);
        expect(await girisYap("deniz", "Boşluk Önemli")).toBeNull();
        expect(await girisYap("deniz", "  boşluk önemli ")).toBeNull();
        expect(await girisYap("DENİZ", "  Boşluk Önemli ")).not.toBeNull();
    });
});

describe("oturum", () => {
    it("girişte oturum açar, çıkışta iptal eder; DB yalnızca anahtar özetini tutar", async () => {
        await kayitOl("mert", "parola123");
        const k = (await girisYap("mert", "parola123"))!;
        const token = oturumAc(k.id);
        expect(oturumKullanicisi(token)?.kullaniciAdi).toBe("mert");
        const kayitli = getDb().prepare("SELECT id FROM oturumlar").get() as { id: string };
        expect(kayitli.id).not.toBe(token);
        oturumKapat(token);
        expect(oturumKullanicisi(token)).toBeNull();
        expect(oturumKullanicisi("uydurma")).toBeNull();
    });

    it("geçici şifre eski oturumları kapatır ve değiştirme ister", async () => {
        await kayitOl("zeynep", "parola123");
        const k = (await girisYap("zeynep", "parola123"))!;
        const eski = oturumAc(k.id);
        const gecici = (await geciciSifreAta("Zeynep"))!;
        expect(oturumKullanicisi(eski)).toBeNull();
        expect(await girisYap("zeynep", "parola123")).toBeNull();
        const yeniden = (await girisYap("zeynep", gecici))!;
        expect(yeniden.sifreDegismeli).toBe(true);

        const bu = oturumAc(yeniden.id);
        const baska = oturumAc(yeniden.id);
        await sifreDegistir(yeniden.id, "yeni-parola", bu);
        expect(oturumKullanicisi(bu)?.sifreDegismeli).toBe(false);
        expect(oturumKullanicisi(baska)).toBeNull();
    });
});

describe("güvenlik yardımcıları", () => {
    it("başka kökenden gelen istekleri reddeder", () => {
        expect(kaynakGecerli({ origin: "https://ekinos.example", host: "ekinos.example" })).toBe(true);
        expect(kaynakGecerli({ origin: "https://kotu.example", host: "ekinos.example" })).toBe(false);
        expect(kaynakGecerli({ host: "ekinos.example" })).toBe(false);
    });

    it("oran sınırı pencere dolunca sıfırlanır", () => {
        let simdi = 0;
        const sinir = new OranSiniri(2, 1000, () => simdi);
        expect([sinir.dene("x"), sinir.dene("x"), sinir.dene("x")]).toEqual([true, true, false]);
        simdi = 1000;
        expect(sinir.dene("x")).toBe(true);
    });
});

describe("oturum deposu", () => {
    it("sonuçları bir kez yazar, profil yalnızca tamamlanan oturumları gösterir", async () => {
        await kayitOl("ali", "parola123");
        const ali = (await girisYap("ali", "parola123"))!;
        const depo = aileDeposu(getDb());
        depo.oturumBasladi({ id: "o1", odaKodu: "ABCDEF", oyunlar: ["sayi-avi", "kutu-say"], baslangic: 1 });
        depo.oturumBasladi({ id: "o2", odaKodu: "ABCDEF", oyunlar: ["sayi-avi"], baslangic: 5 });
        const tur = {
            id: "t1", odaKodu: "ABCDEF", oturumId: "o1", oturumSirasi: 0, oyun: "sayi-avi" as const,
            kuralSurumu: "sayi-avi@1", icerik: [1], baslangic: 1, bitis: 2,
        };
        depo.turBasladi(tur);
        const sonuc = {
            id: ali.id, ad: "ali", renk: "", sira: 1, durum: "bitirdi" as const, hamMs: 10, hata: 0, cezaMs: 0,
            nihaiMs: 10, ilerleme: 25, toplam: 25, puan: null, turPuani: 2, oyuncuSayisi: 2,
        };
        expect(depo.turBitti("t1", [sonuc])).toBe(true);
        expect(depo.turBitti("t1", [sonuc])).toBe(false);
        const toplam = { id: ali.id, ad: "ali", renk: "", sira: 1, puan: 7, ayrildi: false, oyuncuSayisi: 2 };
        expect(depo.oturumBitti("o1", [toplam], 9)).toBe(true);
        expect(depo.oturumBitti("o1", [toplam], 9)).toBe(false);
        depo.oturumKesildi("o2");
        expect(depo.profilGecmisi(ali.id)).toEqual([
            { oturumId: "o1", baslangic: 1, sira: 1, puan: 7, oyuncuSayisi: 2, ayrildi: false, oyunlar: ["sayi-avi", "kutu-say"] },
        ]);
        expect(depo.sonTurKesildiMi("ABCDEF", 10)).toBe(true);
        expect(getDb().prepare("SELECT puan, tur_puani FROM aile_sonuclari").get()).toEqual({ puan: null, tur_puani: 2 });
    });

    it("yeniden açılışta süren tur ve oturumlar kesildi olarak işaretlenir", () => {
        const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ekinos-")), "test.db");
        const ilk = veritabaniAc(dosya);
        const depo = aileDeposu(ilk);
        depo.oturumBasladi({ id: "o9", odaKodu: "QQQQQQ", oyunlar: ["sayi-avi"], baslangic: 1 });
        depo.turBasladi({
            id: "t9", odaKodu: "QQQQQQ", oturumId: "o9", oturumSirasi: 0, oyun: "sayi-avi", kuralSurumu: "x",
            icerik: [], baslangic: 1, bitis: 2,
        });
        ilk.close();
        const ikinci = veritabaniAc(dosya);
        expect((ikinci.prepare("SELECT durum FROM aile_turlari").get() as { durum: string }).durum).toBe("kesildi");
        expect((ikinci.prepare("SELECT durum FROM aile_oyun_oturumlari").get() as { durum: string }).durum).toBe("kesildi");
        ikinci.close();
    });
});
