import { NextResponse, type NextRequest } from "next/server";
import { kayitOl, oturumAc } from "@/lib/server/auth";
import { istemciAdresi, sinir } from "@/lib/server/guvenlik";
import { hataYaniti, jsonGovde, kaynakDenetimi, oturumCereziYaz } from "@/lib/server/istek";

export async function POST(req: NextRequest) {
    const red = kaynakDenetimi(req);
    if (red) return red;
    if (!sinir("kayit").dene(istemciAdresi(req.headers))) {
        return hataYaniti("Çok fazla deneme oldu. Biraz sonra tekrar dene.", 429);
    }
    const govde = await jsonGovde(req);
    const sonuc = await kayitOl(govde.kullaniciAdi, govde.sifre);
    if (!sonuc.ok) return hataYaniti(sonuc.hata, 400);
    const yanit = NextResponse.json({ kullanici: { kullaniciAdi: sonuc.kullanici.kullaniciAdi } });
    return oturumCereziYaz(yanit, oturumAc(sonuc.kullanici.id));
}
