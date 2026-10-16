import Link from "next/link";
import { Avatar } from "@/components/aile/Ikon";
import { CikisDugmesi } from "@/components/aile/CikisDugmesi";
import { aileDeposu } from "@/lib/aile/depo";
import { oyunKarti, sureYaz } from "@/lib/aile/katalog";
import { getDb } from "@/lib/server/db";
import { girisGerekli } from "@/lib/server/sayfa";

export const metadata = { title: "Profilim" };

const DURUM_ETIKETI = { bitirdi: "Bitirdi", bitiremedi: "Süre doldu", koptu: "Bağlantı koptu", ayrildi: "Ayrıldı" };
const tarih = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export default async function ProfilSayfasi() {
    const kullanici = await girisGerekli("/profil");
    const turlar = aileDeposu(getDb()).profilGecmisi(kullanici.id, 20);
    return (
        <div className="profile-card">
            <div className="profile-head">
                <Avatar ad={kullanici.kullaniciAdi} renk={kullanici.avatarRenk} buyuk />
                <div>
                    <h1>{kullanici.kullaniciAdi}</h1>
                    <p className="muted">Son 20 aile turun burada.</p>
                </div>
            </div>
            <div className="panel">
                <h2>Oyun geçmişin</h2>
                {turlar.length === 0 ? (
                    <div className="empty-history spaced">
                        <h2>İlk tur seni bekliyor.</h2>
                        <p>Ailenle bir oda kur. Birlikte oynadığınız turlar burada görünsün.</p>
                        <Link className="btn primary" href="/oyna/sayi-avi#oda-kur">İlk odamı kur</Link>
                    </div>
                ) : (
                    <ul className="history spaced">
                        {turlar.map((t) => (
                            <li key={t.turId}>
                                <span className={t.sira === 1 && t.durum === "bitirdi" ? "rank-badge first" : "rank-badge"}>
                                    <span className="sr-only">Sıra </span>{t.sira}.
                                </span>
                                <div className="meta">
                                    <strong>{oyunKarti(t.oyun).ad}</strong>
                                    <small>{tarih.format(t.baslangic)} · {t.oyuncuSayisi} oyuncu</small>
                                </div>
                                {t.durum === "bitirdi" ? (
                                    <strong>{sureYaz(t.nihaiMs)}</strong>
                                ) : (
                                    <span className="status-chip bad">{DURUM_ETIKETI[t.durum]}</span>
                                )}
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
