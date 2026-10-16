import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OTURUM_CEREZI, oturumKullanicisi } from "./auth";

// Session lookup for family-app server components.

export async function sayfaKullanicisi() {
    const deposu = await cookies();
    return oturumKullanicisi(deposu.get(OTURUM_CEREZI)?.value);
}

/** Signed-in user, or a redirect to sign-in that comes back to `sonra`. */
export async function girisGerekli(sonra: string) {
    const kullanici = await sayfaKullanicisi();
    if (!kullanici) redirect(`/giris?sonra=${encodeURIComponent(sonra)}`);
    if (kullanici.sifreDegismeli) redirect("/sifre");
    return kullanici;
}

/** Only same-site paths are followed after sign-in. */
export function guvenliDonus(sonra: string | string[] | undefined) {
    const yol = Array.isArray(sonra) ? sonra[0] : sonra;
    return yol && yol.startsWith("/") && !yol.startsWith("//") && !yol.startsWith("/\\") ? yol : "/oyna";
}
