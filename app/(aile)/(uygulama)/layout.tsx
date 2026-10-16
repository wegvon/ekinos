import Link from "next/link";
import { Avatar } from "@/components/aile/Ikon";
import { Gezinti } from "@/components/aile/Gezinti";
import { girisGerekli } from "@/lib/server/sayfa";

export default async function UygulamaDuzeni({ children }: { children: React.ReactNode }) {
    const kullanici = await girisGerekli("/oyna");
    return (
        <>
            <div className="shell">
                <aside className="sidebar">
                    <Link className="brand" href="/oyna" aria-label="Ekinos ana ekran">
                        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                        <span>
                            <span className="brand-name">ekinos</span>
                            <span className="brand-note">ailece, aynı anda</span>
                        </span>
                    </Link>
                    <Gezinti />
                    <div className="sidebar-note">
                        <strong>Küçük bir oyun molası.</strong>Herkes kendi ekranında.<br />Eğlencesi aynı odada.
                    </div>
                </aside>
                <div className="content">
                    <header className="topbar">
                        <div className="crumb"><span className="crumb-label">Ailenin oyun kulübü</span></div>
                        <Link className="account" href="/profil">
                            <span>Merhaba, {kullanici.kullaniciAdi}</span>
                            <Avatar ad={kullanici.kullaniciAdi} renk={kullanici.avatarRenk} />
                        </Link>
                    </header>
                    <main>{children}</main>
                </div>
            </div>
            <Gezinti mobil />
        </>
    );
}
