import { NextResponse, type NextRequest } from "next/server";
import { OTURUM_CEREZI, sifreDegistir, sifreDogrula, sifreHatasi } from "@/lib/server/auth";
import { sinir } from "@/lib/server/guvenlik";
import { hataYaniti, istekKullanicisi, jsonGovde, kaynakDenetimi } from "@/lib/server/istek";

export async function POST(req: NextRequest) {
    const red = kaynakDenetimi(req);
    if (red) return red;
    const kullanici = istekKullanicisi(req);
    if (!kullanici) return hataYaniti("Önce giriş yapmalısın.", 401);
    if (!sinir("giris").dene(`sifre:${kullanici.id}`)) {
        return hataYaniti("Çok fazla deneme oldu. Birkaç dakika sonra tekrar dene.", 429);
    }
    const govde = await jsonGovde(req);
    if (typeof govde.mevcut !== "string" || !(await sifreDogrula(kullanici.id, govde.mevcut))) {
        return hataYaniti("Şu anki şifre hatalı.", 400);
    }
    const hata = sifreHatasi(govde.yeni);
    if (hata) return hataYaniti(hata, 400);
    await sifreDegistir(kullanici.id, govde.yeni as string, req.cookies.get(OTURUM_CEREZI)?.value);
    return NextResponse.json({ ok: true });
}
