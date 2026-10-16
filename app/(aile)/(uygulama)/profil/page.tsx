import Link from "next/link";
import { Avatar } from "@/components/aile/Ikon";
import { CikisDugmesi } from "@/components/aile/CikisDugmesi";
import { aileDeposu } from "@/lib/aile/depo";
import { oyunKarti } from "@/lib/aile/katalog";
import { getDb } from "@/lib/server/db";
import { girisGerekli } from "@/lib/server/sayfa";

export const metadata = { title: "Profilim" };

const tarih = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export default async function ProfilSayfasi() {
    const kullanici = await girisGerekli("/profil");
    const oturumlar = aileDeposu(getDb()).profilGecmisi(kullanici.id, 20);
    return (
        <div className="profile-card">
            <div className="profile-head">
                <Avatar ad={kullanici.kullaniciAdi} renk={kullanici.avatarRenk} buyuk />
                <div>
                    <h1>{kullanici.kullaniciAdi}</h1>
                    <p className="muted">Son 20 oturumun burada.</p>
                </div>
            </div>
            <div className="panel">
                <h2>Oturum geçmişin</h2>
                {oturumlar.length === 0 ? (
                    <div className="empty-history spaced">
                        <h2>İlk oturum seni bekliyor.</h2>
                        <p>Ailenle bir oturum aç. Birlikte oynadığınız oturumlar burada görünsün.</p>
                        <Link className="btn primary" href="/oyna#oturum-ac">İlk oturumumu aç</Link>
                    </div>
                ) : (
                    <ul className="history spaced">
                        {oturumlar.map((o) => (
                            <li key={o.oturumId}>
                                <span className={o.sira === 1 && !o.ayrildi ? "rank-badge first" : "rank-badge"}>
                                    <span className="sr-only">Sıra </span>{o.sira}.
                                </span>
                                <div className="meta">
                                    <strong>{o.oyunlar.map((oyun) => oyunKarti(oyun).ad).join(" · ")}</strong>
                                    <small>{tarih.format(o.baslangic)} · {o.oyuncuSayisi} oyuncu{o.ayrildi ? " · Erken ayrıldın" : ""}</small>
                                </div>
                                <strong>{o.puan} puan</strong>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="setting-line spaced">
                    <strong>Kullanıcı adı ve şifreyle giriş</strong>
                    <p>E-posta adresi veya gerçek ad gerekmez. <Link className="text-link" href="/sifre">Şifremi değiştir</Link></p>
                </div>
                <CikisDugmesi />
            </div>
        </div>
    );
}
