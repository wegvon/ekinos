import Link from "next/link";
import { Ikon } from "@/components/aile/Ikon";
import { OyunKapagi } from "@/components/aile/OyunKapagi";
import { AILE_KATALOGU } from "@/lib/aile/katalog";

export const metadata = { title: "Oyunlar" };

export default function OyunlarSayfasi() {
    return (
        <>
            <div className="page-title">
                <div>
                    <h1>Birlikte daha eğlenceli.</h1>
                    <p>Bir oyun seç. Aileni çağır. Küçük bir rekabet başlasın.</p>
                </div>
                <span className="chip outline"><Ikon ad="people" />2–8 kişi</span>
            </div>
            <div className="play-together">
                <div>
                    <div className="eyebrow">Bu akşamın planı</div>
                    <h2>Bir oda, herkes oyunda.</h2>
                    <p>Telefon, tablet, bilgisayar… Herkes kendi cihazından katılsın, aynı anda başlayın.</p>
                </div>
                <div className="together-actions">
                    <Link className="btn warm" href="/oyna/sayi-avi#oda-kur"><Ikon ad="plus" />Oda kur</Link>
                    <Link className="text-link" href="/katil">Kodla katıl <Ikon ad="arrow" /></Link>
                </div>
            </div>
            <div className="section-heading">
                <div>
                    <h2>Ailece kapışalım</h2>
                    <p>Kısa turlar. Aynı oyun. Tatlı rekabet.</p>
                </div>
                <span className="chip green">Birlikte oyna</span>
            </div>
            <div className="games">
                {AILE_KATALOGU.map((oyun) => (
                    <Link key={oyun.slug} className={`game-card${oyun.acik ? "" : " coming"}`} href={`/oyna/${oyun.slug}`}>
                        <OyunKapagi slug={oyun.slug} etiket={oyun.acik ? oyun.etiket.toLocaleUpperCase("tr-TR") : "YAKINDA"} />
                        <div className="game-info">
                            <h3>{oyun.ad}</h3>
                            <p>{oyun.kisa}</p>
                            <div className="bottom">
                                <span>2–8 kişi · {oyun.sure}</span>
                                <span className="arrow-disc"><Ikon ad="arrow" /></span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
            <div className="catalog-foot"><p>En güzel skor, birlikte geçirilen zaman.</p></div>
        </>
    );
}
