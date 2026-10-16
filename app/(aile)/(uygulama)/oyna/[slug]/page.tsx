import Link from "next/link";
import { notFound } from "next/navigation";
import { Ikon } from "@/components/aile/Ikon";
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
                <OyunKapagi slug={oyun.oyun} buyuk />
                <div className="detail-copy">
                    <span className="chip green">{oyun.etiket} · {oyun.sure}</span>
                    <h1>{oyun.ad}</h1>
                    <p>{oyun.aciklama}</p>
                    <Link className="btn primary" href="/oyna#oturum-ac">Oturum aç <Ikon ad="arrow" /></Link>
                </div>
            </div>
            <div className="panel spaced">
                <h2>Bir dakikada öğren.</h2>
                <ol className="rules">
                    {oyun.kurallar.map((k) => <li key={k}>{k}</li>)}
                </ol>
                <p className="note">Bu oyun oturumlarda rastgele sırayla gelir. Her oyunda birinci, oyuncu sayısı kadar puan alır.</p>
            </div>
        </>
    );
}
