import Link from "next/link";
import { Ikon } from "@/components/aile/Ikon";
import { OturumAcFormu } from "@/components/aile/OturumAcFormu";
import { OyunKapagi } from "@/components/aile/OyunKapagi";
import { AILE_KATALOGU } from "@/lib/aile/katalog";
import { OTURUM_OYUN_SAYISI } from "@/lib/aile/tipler";

export const metadata = { title: "Oyunlar" };

export default function OyunlarSayfasi() {
    return (
        <>
            <div className="page-title">
                <div>
                    <h1>Birlikte daha eğlenceli.</h1>
                    <p>Bir oturum aç. Aileni çağır. {OTURUM_OYUN_SAYISI} oyunluk tatlı bir rekabet başlasın.</p>
                </div>
                <span className="chip outline"><Ikon ad="people" />2–8 kişi</span>
            </div>
            <div className="play-together">
                <div>
                    <div className="eyebrow">Bu akşamın planı</div>
                    <h2>Bir oturum, {OTURUM_OYUN_SAYISI} oyun.</h2>
                    <p>Herkes kendi cihazından katılsın. Oyunlar rastgele sırayla gelir, puanlar oyun oyun toplanır.</p>
                </div>
                <div className="together-actions">
                    <a className="btn warm" href="#oturum-ac"><Ikon ad="plus" />Oturum aç</a>
                    <Link className="text-link" href="/katil">Kodla katıl <Ikon ad="arrow" /></Link>
                </div>
            </div>
            <OturumAcFormu />
            <div className="section-heading spaced">
                <div>
                    <h2>Oturumda neler var?</h2>
                    <p>Her oturumda bu oyunlar karışık sırayla gelir.</p>
                </div>
                <span className="chip green">Birlikte oyna</span>
            </div>
            <div className="games">
                {AILE_KATALOGU.map((oyun) => (
                    <Link key={oyun.oyun} className="game-card" href={`/oyna/${oyun.oyun}`}>
                        <OyunKapagi slug={oyun.oyun} etiket={oyun.etiket.toLocaleUpperCase("tr-TR")} />
                        <div className="game-info">
                            <h3>{oyun.ad}</h3>
                            <p>{oyun.kisa}</p>
                            <div className="bottom">
                                <span>{oyun.sure}</span>
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
