import { redirect } from "next/navigation";
import { HesapFormu } from "@/components/aile/HesapFormu";
import { guvenliDonus, sayfaKullanicisi } from "@/lib/server/sayfa";

export const metadata = { title: "Giriş yap" };

export default async function GirisSayfasi({ searchParams }: { searchParams: Promise<{ sonra?: string }> }) {
    const sonra = guvenliDonus((await searchParams).sonra);
    if (await sayfaKullanicisi()) redirect(sonra);
    return <HesapFormu mod="giris" sonra={sonra} />;
}
