import { NextResponse, type NextRequest } from "next/server";
import { girisYap, kullaniciAdiNormalize, oturumAc } from "@/lib/server/auth";
import { istemciAdresi, sinir } from "@/lib/server/guvenlik";
import { hataYaniti, jsonGovde, kaynakDenetimi, oturumCereziYaz } from "@/lib/server/istek";

export async function POST(req: NextRequest) {
    const red = kaynakDenetimi(req);
    if (red) return red;
    const govde = await jsonGovde(req);
    const ad = typeof govde.kullaniciAdi === "string" ? kullaniciAdiNormalize(govde.kullaniciAdi.trim()) : "";
    if (!sinir("giris").dene(`${istemciAdresi(req.headers)}:${ad}`)) {
        return hataYaniti("Çok fazla deneme oldu. Birkaç dakika sonra tekrar dene.", 429);
    }
    const kullanici = await girisYap(govde.kullaniciAdi, govde.sifre);
    if (!kullanici) return hataYaniti("Kullanıcı adı veya şifre hatalı.", 401);
    const yanit = NextResponse.json({
        kullanici: { kullaniciAdi: kullanici.kullaniciAdi },
        sifreDegismeli: kullanici.sifreDegismeli,
    });
    return oturumCereziYaz(yanit, oturumAc(kullanici.id));
}
