import { redirect } from "next/navigation";
import { OdaIstemci } from "@/components/aile/oda/OdaIstemci";
import { odaKoduNormalize } from "@/lib/aile/tipler";
import { girisGerekli } from "@/lib/server/sayfa";

export const metadata = { title: "Oyun odası" };

export default async function OdaSayfasi({ params }: { params: Promise<{ kod: string }> }) {
    const ham = decodeURIComponent((await params).kod);
    const kod = odaKoduNormalize(ham);
    if (kod !== ham) redirect(`/oda/${encodeURIComponent(kod)}`);
    const kullanici = await girisGerekli(`/oda/${kod}`);
    return <OdaIstemci kod={kod} benAdi={kullanici.kullaniciAdi} />;
}
