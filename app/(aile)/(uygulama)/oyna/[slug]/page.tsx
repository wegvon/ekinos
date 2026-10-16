import Link from "next/link";
import { notFound } from "next/navigation";
import { Ikon } from "@/components/aile/Ikon";
import { OdaKurFormu } from "@/components/aile/OdaKurFormu";
import { OyunKapagi } from "@/components/aile/OyunKapagi";
import { katalogdan } from "@/lib/aile/katalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    return { title: katalogdan((await params).slug)?.ad ?? "Oyun" };
}

export default async function OyunDetaySayfasi({ params }: { params: Promise<{ slug: string }> }) {
    const oyun = katalogdan((await params).slug);
    if (!oyun) notFound();
    return (
        <>
            <Link className="text-link back" href="/oyna"><Ikon ad="back" />Oyunlara dön</Link>
            <div className="detail-layout">
                <OyunKapagi slug={oyun.slug} buyuk />
                <div className="detail-copy">
                    <span className="chip green">{oyun.etiket} · 2–8 kişi · {oyun.sure}</span>
                    <h1>{oyun.ad}</h1>
                    <p>{oyun.aciklama}</p>
                    {oyun.acik ? (
                        <a className="btn primary" href="#oda-kur">Bu oyunla oda kur <Ikon ad="arrow" /></a>
                    ) : (
                        <p className="banner info">Bu oyunun aile modu yakında geliyor. Şimdilik Sayı Avı ile oda kurabilirsin.</p>
                    )}
                </div>
            </div>
            <div className="panel spaced">
                <h2>Bir dakikada öğren.</h2>
                <ol className="rules">
                    {oyun.kurallar.map((k) => <li key={k}>{k}</li>)}
                </ol>
                {oyun.slug === "sayi-avi" && (
                    <p className="note">Sonuç = bitirme süresi + her yanlış dokunuş için 2 saniye. Düşük sonuç daha iyi.</p>
                )}
            </div>
            {oyun.acik && oyun.oyun && <OdaKurFormu oyun={oyun.oyun} oyunAdi={oyun.ad} />}
        </>
    );
}
