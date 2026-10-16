import { redirect } from "next/navigation";
import { HesapFormu } from "@/components/aile/HesapFormu";
import { guvenliDonus, sayfaKullanicisi } from "@/lib/server/sayfa";

export const metadata = { title: "Hesap oluştur" };

export default async function KayitSayfasi({ searchParams }: { searchParams: Promise<{ sonra?: string }> }) {
    const sonra = guvenliDonus((await searchParams).sonra);
    if (await sayfaKullanicisi()) redirect(sonra);
    return <HesapFormu mod="kayit" sonra={sonra} />;
}
