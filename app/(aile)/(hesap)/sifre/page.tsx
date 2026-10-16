import { redirect } from "next/navigation";
import { SifreFormu } from "@/components/aile/HesapFormu";
import { sayfaKullanicisi } from "@/lib/server/sayfa";

export const metadata = { title: "Şifre" };

export default async function SifreSayfasi() {
    const kullanici = await sayfaKullanicisi();
    if (!kullanici) redirect("/giris?sonra=%2Fsifre");
    return <SifreFormu zorunlu={kullanici.sifreDegismeli} />;
}
