import { redirect } from "next/navigation";
import { OdaIstemci } from "@/components/aile/oda/OdaIstemci";
import { odaKoduNormalize } from "@/lib/aile/tipler";
import { girisGerekli } from "@/lib/server/sayfa";

export const metadata = { title: "Oyun oturumu" };

export default async function OturumSayfasi({ params }: { params: Promise<{ kod: string }> }) {
    const ham = decodeURIComponent((await params).kod);
    const kod = odaKoduNormalize(ham);
    if (kod !== ham) redirect(`/oturum/${encodeURIComponent(kod)}`);
    const kullanici = await girisGerekli(`/oturum/${kod}`);
    return <OdaIstemci kod={kod} benAdi={kullanici.kullaniciAdi} />;
}
