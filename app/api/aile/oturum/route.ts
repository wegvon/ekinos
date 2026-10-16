import { NextResponse, type NextRequest } from "next/server";
import { odaYoneticisi } from "@/lib/aile/yonetici";
import { sinir } from "@/lib/server/guvenlik";
import { hataYaniti, istekKullanicisi, jsonGovde, kaynakDenetimi } from "@/lib/server/istek";

const OTURUM_ADI_EN_COK = 24;

export async function POST(req: NextRequest) {
    const red = kaynakDenetimi(req);
    if (red) return red;
    const kullanici = istekKullanicisi(req);
    if (!kullanici) return hataYaniti("Önce giriş yapmalısın.", 401);
    if (kullanici.sifreDegismeli) return hataYaniti("Önce şifreni değiştirmelisin.", 403);
    if (!sinir("odaKur").dene(kullanici.id)) return hataYaniti("Çok fazla oturum açıldı. Biraz sonra tekrar dene.", 429);

    const govde = await jsonGovde(req);
    const ad = typeof govde.ad === "string" ? govde.ad.trim().slice(0, OTURUM_ADI_EN_COK) || null : null;

    const kod = odaYoneticisi().odaKur(
        { id: kullanici.id, ad: kullanici.kullaniciAdi, renk: kullanici.avatarRenk },
        ad
    );
    return NextResponse.json({ kod }, { headers: { "Cache-Control": "no-store" } });
}
