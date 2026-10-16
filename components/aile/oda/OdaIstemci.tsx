"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AILE_KATALOGU, oyunKarti, sureYaz } from "@/lib/aile/katalog";
import { AILE_OYUNLARI } from "@/lib/aile/oyunlar";
import type { AileOyunu } from "@/lib/aile/oyunlar/oyun";
import {
    ODA_EN_AZ_OYUNCU,
    ODA_KAPASITESI,
    OTURUM_OYUN_SAYISI,
    type BenimTurum,
    type IlerlemeGorunumu,
    type IslemHatasi,
    type OdaGorunumu,
    type OyuncuGorunumu,
    type SonucSatiri,
    type TurGorunumu,
} from "@/lib/aile/tipler";
import { Avatar, Ikon } from "../Ikon";
import { OyunTahtasi, type GeriBildirim } from "./OyunTahtalari";
import { useOda, type HamleYaniti, type Son } from "./useOda";

// The whole session lives on one page: lobby → (countdown → board → round
// results) × 5 → final standings.

interface YerelTur {
    turId: string;
    sira: number;
    /** The game's own state for games we can predict; the server's view otherwise. */
    durum: unknown;
}

const kuralOf = (tur: TurGorunumu) => AILE_OYUNLARI[tur.oyun] as AileOyunu<unknown, unknown>;
/** Games whose state the page can work out itself (no hidden content). */
const tahminli = (tur: TurGorunumu) => !kuralOf(tur).istemciDurumu;

const ISLEM_HATALARI: Record<IslemHatasi, string> = {
    yetki_yok: "Bunu yalnızca oturum sahibi yapabilir.",
    gecersiz_asama: "Bu adım şu anda yapılamıyor.",
    az_oyuncu: `Başlamak için en az ${ODA_EN_AZ_OYUNCU} bağlı oyuncu gerekiyor.`,
    hazir_degil: "Herkes hazır olunca başlatabilirsin.",
    cok_hizli: "Çok hızlı dokunuyorsun; birkaç dokunuş sayılmadı.",
};

export function OdaIstemci({ kod, benAdi }: { kod: string; benAdi: string }) {
    const router = useRouter();
    const [yerel, setYerel] = useState<YerelTur | null>(null);
    const [geriBildirim, setGeriBildirim] = useState<GeriBildirim | null>(null);

    const hamleYaniti = useCallback((y: HamleYaniti) => {
        setYerel((onceki) => {
            if (!onceki || onceki.turId !== y.turId) return onceki;
            // A rejected move, or the reply to our latest move, is the truth.
            if (!y.kabul || y.sira >= onceki.sira) return { turId: y.turId, sira: y.ben.sonSira, durum: y.ben.durum };
            return onceki;
        });
    }, []);

    const { oda, benId, baglanti, son, islemHatasi, gonder, sunucuZamani, yenidenDene } = useOda(kod, hamleYaniti);
    const simdi = useSunucuSaati(sunucuZamani, !!oda?.tur || oda?.araBitis != null);

    // Adopt the server's view of our board on a new round or after reconnecting.
    const tur = oda?.tur ?? null;
    useEffect(() => {
        if (!tur?.ben) return;
        const ben = tur.ben;
        setYerel((onceki) =>
            !onceki || onceki.turId !== tur.id || ben.sonSira >= onceki.sira
                ? { turId: tur.id, sira: ben.sonSira, durum: ben.durum }
                : onceki
        );
    }, [tur?.id, tur?.ben]);

    useEffect(() => {
        if (son?.tur === "kapandi" && son.sebep === "ayrildin") router.push("/oyna");
    }, [son, router]);

    const dokun = useCallback(
        (deger: number) => {
            if (!tur || !yerel || yerel.turId !== tur.id || baglanti !== "acik" || tur.ben?.disarida) return;
            const zaman = sunucuZamani();
            if (zaman < tur.baslangic || zaman >= tur.bitis) return;
            const kural = kuralOf(tur);
            let durum = yerel.durum;
            if (tahminli(tur)) {
                if (kural.ozet(durum).bitti) return;
                const sonuc = kural.hamleUygula(durum, deger, zaman - tur.baslangic, tur.icerik);
                // Harmless taps (an already-found number) are not sent.
                if (!sonuc.kabul || sonuc.durum === durum) return;
                const hataOldu = kural.ozet(sonuc.durum).hatalar > kural.ozet(durum).hatalar;
                durum = sonuc.durum;
                const bildirim = { deger, dogru: !hataOldu, an: zaman };
                setGeriBildirim(bildirim);
                setTimeout(() => setGeriBildirim((g) => (g === bildirim ? null : g)), 300);
            } else if (tur.ben?.bitti) {
                return;
            }
            const sira = yerel.sira + 1;
            if (!gonder({ t: "hamle", turId: tur.id, sira, deger })) return;
            setYerel({ turId: tur.id, sira, durum });
        },
        [tur, yerel, baglanti, gonder, sunucuZamani]
    );

    if (son) return <SonEkrani son={son} yenidenDene={yenidenDene} />;
    if (!oda || !benId) {
        return (
            <div className="narrow panel" aria-live="polite">
                <span className="chip outline">Oturum · {kod}</span>
                <h1 className="spaced">{baglanti === "koptu" ? "Bağlanamadık, tekrar deniyoruz." : "Oturuma bağlanıyoruz…"}</h1>
            </div>
        );
    }

    const ben = oda.oyuncular.find((o) => o.id === benId);
    const ortak = { oda, benId, gonder, baglanti, simdi };
    const yerelDurum = tur && yerel?.turId === tur.id ? yerel.durum : tur?.ben?.durum;
    const yerelBitti = !!tur && tahminli(tur) && yerelDurum !== undefined && kuralOf(tur).ozet(yerelDurum).bitti;

    return (
        <>
            {baglanti !== "acik" && (
                <p className="banner warn" role="status">
                    <strong>Seni yeniden bağlıyoruz.</strong>{" "}
                    {oda.asama === "oynaniyor" ? "Oyunun süresi devam ediyor; bu sırada dokunuşlar kapalı." : "Bağlantın dönünce kaldığın yerden devam edeceksin."}
                </p>
            )}
            {islemHatasi && <p className="banner warn" role="alert">{ISLEM_HATALARI[islemHatasi]}</p>}

            {oda.asama === "bekleme" && <Bekleme {...ortak} />}
            {(oda.asama === "geri_sayim" || oda.asama === "oynaniyor") && tur && (
                ben?.turDisinda || !tur.ben ? (
                    <TurDisinda oda={oda} tur={tur} benId={benId} />
                ) : simdi < tur.baslangic ? (
                    <GeriSayim oda={oda} tur={tur} kalanMs={tur.baslangic - simdi} />
                ) : tur.ben.bitti || tur.ben.disarida || yerelBitti ? (
                    <BitirdinBekle oda={oda} tur={tur} benId={benId} benAdi={benAdi} ben={tur.ben} />
                ) : (
                    <Oyun {...ortak} tur={tur} durum={yerelDurum} geriBildirim={geriBildirim} dokun={dokun} />
                )
            )}
            {oda.asama === "tur_sonucu" && <TurSonucu {...ortak} />}
            {oda.asama === "bitti" && <OturumSonucu {...ortak} />}
        </>
    );
}

/** Re-renders on a short interval while a round or a break is on screen. */
function useSunucuSaati(sunucuZamani: () => number, aktif: boolean) {
    const [simdi, setSimdi] = useState(() => sunucuZamani());
    useEffect(() => {
        setSimdi(sunucuZamani());
        if (!aktif) return;
        const zamanlayici = setInterval(() => setSimdi(sunucuZamani()), 100);
        return () => clearInterval(zamanlayici);
    }, [aktif, sunucuZamani]);
    return simdi;
}

interface Ortak {
    oda: OdaGorunumu;
    benId: string;
    gonder: ReturnType<typeof useOda>["gonder"];
    baglanti: ReturnType<typeof useOda>["baglanti"];
    simdi: number;
}

function oyunNoYaz(oda: OdaGorunumu) {
    return `Oyun ${oda.oyunNo + 1} / ${oda.oyunlar?.length ?? OTURUM_OYUN_SAYISI}`;
}

// ── Lobby ──────────────────────────────────────────────────────────────────

function Bekleme({ oda, benId, gonder, baglanti }: Ortak) {
    const ben = oda.oyuncular.find((o) => o.id === benId)!;
    const sahibim = oda.sahipId === benId;
    const bagli = oda.oyuncular.filter((o) => o.bagli);
    const herkesHazir = bagli.length >= ODA_EN_AZ_OYUNCU && bagli.every((o) => o.hazir);
    const sahip = oda.oyuncular.find((o) => o.sahip);
    const acik = baglanti === "acik";

    let baslatNotu = "Başlattığında ilk oyun herkeste aynı anda açılacak.";
    if (bagli.length < ODA_EN_AZ_OYUNCU) baslatNotu = "En az bir kişinin daha katılması gerekiyor.";
    else if (!herkesHazir) baslatNotu = "Herkes “Hazırım” deyince başlatabilirsin.";

    return (
        <>
            <div className="page-title">
                <div>
                    <span className="eyebrow muted">Oyun oturumu</span>
                    <h1 className="spaced">{oda.ad ?? `${sahip?.ad ?? "Ailenin"} oturumu`}</h1>
                    <p>{sahibim ? "Kodu paylaş, herkes gelince birlikte başlayın." : `${sahip?.ad ?? "Oturum sahibi"} oturumu başlatacak. Hazır olunca haber ver.`}</p>
                </div>
                <span className="chip green"><span className="dot" />{oda.oyuncular.length} / {ODA_KAPASITESI} oyuncu</span>
            </div>
            <div className="room-layout">
                <div className="panel">
                    <OturumKodu kod={oda.kod} />
                    <div className="section-heading">
                        <h2>Oturumdakiler</h2>
                        {herkesHazir && <span className="chip green">Herkes hazır</span>}
                    </div>
                    <div className="player-list" aria-live="polite">
                        {oda.oyuncular.map((o) => <OyuncuSatiri key={o.id} oyuncu={o} benim={o.id === benId} />)}
                    </div>
                </div>
                <aside className="panel room-settings">
                    <span className="eyebrow muted">Bu oturumda</span>
                    <div className="room-game">
                        <h3>{OTURUM_OYUN_SAYISI} oyun, rastgele sırayla</h3>
                        <p>{AILE_KATALOGU.map((k) => k.ad).join(" · ")}</p>
                    </div>
                    <button
                        type="button"
                        className={ben.hazir ? "btn secondary full" : "btn primary full"}
                        onClick={() => gonder({ t: "hazir", deger: !ben.hazir })}
                        disabled={!acik}
                        aria-pressed={ben.hazir}
                    >
                        {ben.hazir ? "Hazır değilim" : <>Hazırım <Ikon ad="check" /></>}
                    </button>
                    {sahibim && (
                        <>
                            <button
                                type="button"
                                className="btn warm full spaced"
                                onClick={() => gonder({ t: "baslat" })}
                                disabled={!acik || !herkesHazir}
                            >
                                Oturumu başlat <Ikon ad="arrow" />
                            </button>
                            <p className="note spaced">{baslatNotu}</p>
                        </>
                    )}
                    <div className="room-tip">
                        <strong>Her oyunda puan toplanır.</strong>Birinci, oyuncu sayısı kadar puan alır; sonuncu 1 puan. En çok puanı toplayan oturumu kazanır.
                    </div>
                    <button type="button" className="text-link spaced" onClick={() => gonder({ t: "ayril" })}>
                        Oturumdan ayrıl
                    </button>
                </aside>
            </div>
        </>
    );
}

function OturumKodu({ kod }: { kod: string }) {
    const [kopyalandi, setKopyalandi] = useState(false);
    async function paylas() {
        const url = `${window.location.origin}/oturum/${kod}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: "Ekinos oturumu", text: `Oturum kodu: ${kod}`, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setKopyalandi(true);
            setTimeout(() => setKopyalandi(false), 2000);
        } catch {
            // Share sheet dismissed; nothing to do.
        }
    }
    return (
        <div className="room-code">
            <div>
                <span className="eyebrow">Katılma kodu</span>
                <br />
                <strong aria-label={`Oturum kodu ${kod.split("").join(" ")}`}>{kod}</strong>
                <p>Ailene bu kodu söyle.</p>
            </div>
            <button type="button" className="text-link" onClick={paylas}>
                <Ikon ad="share" />
                {kopyalandi ? "Bağlantı kopyalandı" : "Paylaş"}
            </button>
        </div>
    );
}

function OyuncuSatiri({ oyuncu, benim }: { oyuncu: OyuncuGorunumu; benim: boolean }) {
    return (
        <div className="player-row">
            <Avatar ad={oyuncu.ad} renk={oyuncu.renk} />
            <div className="person">
                <strong>{oyuncu.ad}{benim && <span className="muted"> · Sen</span>}</strong>
                <small>{oyuncu.sahip ? "Oturum sahibi" : "Oyuncu"}</small>
            </div>
            {!oyuncu.bagli ? (
                <span className="offline"><Ikon ad="wifiOff" />Bağlantı bekleniyor</span>
            ) : oyuncu.hazir ? (
                <span className="ready"><Ikon ad="check" />Hazır</span>
            ) : (
                <span className="not-ready">Hazır değil</span>
            )}
        </div>
    );
}

// ── Countdown and play ────────────────────────────────────────────────────

function GeriSayim({ oda, tur, kalanMs }: { oda: OdaGorunumu; tur: TurGorunumu; kalanMs: number }) {
    const sayi = Math.min(3, Math.max(1, Math.ceil(kalanMs / 1000)));
    const kart = oyunKarti(tur.oyun);
    return (
        <div className="narrow countdown-card">
            <div>
                <span className="chip green">{oyunNoYaz(oda)} · {tur.ilerlemeler.length} oyuncu</span>
                <h1 className="spaced">{kart.ad}</h1>
                <div className="countdown-number" role="timer" aria-live="assertive">{sayi}</div>
                <p className="muted">{kart.ipucu}</p>
            </div>
        </div>
    );
}

function sayac(ms: number) {
    const kalan = Math.max(0, ms);
    const dk = Math.floor(kalan / 60_000);
    const sn = (kalan % 60_000) / 1000;
    return `${String(dk).padStart(2, "0")}:${sn.toFixed(1).padStart(4, "0").replace(".", ",")}`;
}

function Oyun({
    oda,
    benId,
    gonder,
    baglanti,
    simdi,
    tur,
    durum,
    geriBildirim,
    dokun,
}: Ortak & {
    tur: TurGorunumu;
    durum: unknown;
    geriBildirim: GeriBildirim | null;
    dokun: (deger: number) => void;
}) {
    const [ayrilOnayi, setAyrilOnayi] = useState(false);
    const kapali = baglanti !== "acik";
    const kart = oyunKarti(tur.oyun);
    const ozet = tahminli(tur) && durum !== undefined ? kuralOf(tur).ozet(durum) : tur.ben;
    return (
        <div className="arena">
            <div>
                <div className="game-stage">
                    <div className="game-status">
                        <div>
                            <span className="eyebrow muted">{oyunNoYaz(oda)}</span>
                            <h1>{kart.ad}</h1>
                        </div>
                        <span className="timer" role="timer" aria-label="Kalan süre">{sayac(tur.bitis - simdi)}</span>
                    </div>
                    {durum !== undefined && (
                        <OyunTahtasi tur={tur} durum={durum} geriBildirim={geriBildirim} dokun={dokun} kapali={kapali} />
                    )}
                    <p className="game-caption">{kart.ipucu}</p>
                </div>
                <div className="game-exit">
                    {ayrilOnayi ? (
                        <div className="state-strip" role="alertdialog" aria-label="Oturumdan ayrılma onayı">
                            <strong>Oturumdan ayrılalım mı?</strong>
                            <p>Bu oyundaki sonucun “ayrıldı” olarak görünür ve kalan oyunlardan puan alamazsın.</p>
                            <div className="row wrap">
                                <button type="button" className="btn primary" onClick={() => setAyrilOnayi(false)}>Oyunda kal</button>
                                <button type="button" className="btn secondary" onClick={() => gonder({ t: "ayril" })}>Evet, ayrıl</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className="text-link" onClick={() => setAyrilOnayi(true)}>Oturumdan ayrıl</button>
                    )}
                </div>
            </div>
            <IlerlemeListesi
                oda={oda}
                benId={benId}
                ilerlemeler={tur.ilerlemeler}
                ben={ozet ? { ilerleme: ozet.ilerleme, puan: ozet.puan } : undefined}
            />
        </div>
    );
}

function IlerlemeListesi({
    oda,
    benId,
    ilerlemeler,
    ben,
}: {
    oda: OdaGorunumu;
    benId: string;
    ilerlemeler: IlerlemeGorunumu[];
    ben?: { ilerleme: number; puan: number | null };
}) {
    // Our own line follows our taps without waiting for the next broadcast.
    const satirlar = ilerlemeler.map((i) =>
        i.id === benId && ben ? { ...i, ilerleme: Math.max(ben.ilerleme, i.ilerleme), puan: ben.puan ?? i.puan } : i
    );
    const enYuksek = Math.max(1, ...satirlar.map((i) => i.puan ?? 0));
    return (
        <aside className="progress-list" aria-label="Oyuncuların ilerlemesi">
            <h2>Aynı anda oynuyoruz</h2>
            {satirlar.map((i) => {
                const oyuncu = oda.oyuncular.find((o) => o.id === i.id);
                const benim = i.id === benId;
                const ad = oyuncu?.ad ?? "Ayrılan oyuncu";
                const oran = i.toplam !== null ? i.ilerleme / i.toplam : (i.puan ?? 0) / enYuksek;
                const metin =
                    i.disarida === "koptu" ? "Koptu"
                    : i.disarida === "ayrildi" ? "Ayrıldı"
                    : i.bitti ? "Bitirdi"
                    : i.toplam !== null ? `${i.ilerleme} / ${i.toplam}`
                    : `${i.puan ?? 0} puan`;
                return (
                    <div key={i.id} className={benim ? "progress-player self" : "progress-player"}>
                        <div className="progress-head">
                            <Avatar ad={ad} renk={oyuncu?.renk ?? "#e2e5d9"} />
                            <strong>{ad}{benim && " · Sen"}</strong>
                            <span>{metin}</span>
                        </div>
                        <div className="track"><span style={{ width: `${Math.min(1, oran) * 100}%` }} /></div>
                    </div>
                );
            })}
        </aside>
    );
}

function BitirdinBekle({ oda, tur, benId, benAdi, ben }: { oda: OdaGorunumu; tur: TurGorunumu; benId: string; benAdi: string; ben: BenimTurum }) {
    const devamEdenler = tur.ilerlemeler.filter((i) => !i.bitti && !i.disarida).length;
    const baslik = ben.disarida === "koptu" ? "Bağlantın uzun süre koptu." : ben.bitti ? `Güzel oyundu, ${benAdi}.` : "Sonucun kesinleşiyor…";
    return (
        <div className="arena">
            <div className="panel" aria-live="polite">
                <span className="chip green"><Ikon ad="check" />{ben.bitti ? "Sen tamamladın" : "Oyun sürüyor"}</span>
                <h1 className="spaced">{baslik}</h1>
                {ben.bitti && <p className="muted spaced">Sonucun: {benimSonucum(tur.oyun, ben)}.</p>}
                {ben.disarida === "koptu" && <p className="muted spaced">Bu oyunda “bağlantı koptu” olarak görüneceksin. Sonraki oyuna katılabilirsin.</p>}
                <div className="state-strip">
                    <strong>{devamEdenler > 0 ? "Diğer oyuncular bekleniyor" : "Sonuçlar hazırlanıyor"}</strong>
                    <p>Süre dolunca sonuçlar otomatik açılır.</p>
                </div>
            </div>
            <IlerlemeListesi oda={oda} benId={benId} ilerlemeler={tur.ilerlemeler} />
        </div>
    );
}

function benimSonucum(oyun: TurGorunumu["oyun"], ben: BenimTurum) {
    if (oyun === "sayi-avi") {
        return `${sureYaz(ben.nihaiMs)}${ben.hatalar > 0 ? ` (${sureYaz(ben.hamMs)} + ${ben.hatalar} hata × 2 sn)` : ""}`;
    }
    if (oyun === "hafiza-kartlari") return `${ben.puan} hamle, ${sureYaz(ben.nihaiMs)}`;
    return `${ben.puan} puan`;
}

function TurDisinda({ oda, tur, benId }: { oda: OdaGorunumu; tur: TurGorunumu; benId: string }) {
    return (
        <div className="arena">
            <div className="panel">
                <span className="chip outline">{oyunNoYaz(oda)}</span>
                <h1 className="spaced">Bu oturum sensiz başladı.</h1>
                <p className="muted spaced">Oyunları buradan izleyebilirsin. Oturum bitince bir sonrakinde sen de varsın.</p>
            </div>
            <IlerlemeListesi oda={oda} benId={benId} ilerlemeler={tur.ilerlemeler} />
        </div>
    );
}

// ── Results ───────────────────────────────────────────────────────────────

const DURUM_ETIKETI: Record<SonucSatiri["durum"], string> = {
    bitirdi: "",
    bitiremedi: "Süre doldu",
    koptu: "Bağlantı koptu",
    ayrildi: "Ayrıldı",
};

function sonucMetni(oyun: TurGorunumu["oyun"], s: SonucSatiri) {
    if (s.durum === "koptu" || s.durum === "ayrildi") return null;
    switch (oyun) {
        case "sayi-avi":
            return s.durum === "bitirdi" ? `${sureYaz(s.nihaiMs)}${s.hata ? ` · ${s.hata} hata` : ""}` : `${s.ilerleme} / ${s.toplam} sayı`;
        case "hafiza-kartlari":
            return s.durum === "bitirdi" ? `${s.puan} hamle · ${sureYaz(s.nihaiMs)}` : `${s.ilerleme} / ${s.toplam} çift`;
        default:
            return `${s.puan ?? 0} puan`;
    }
}

function kazananBasligi(adlar: string[], tekil: (ad: string) => string, yok: string) {
    if (adlar.length === 1) return tekil(adlar[0]);
    if (adlar.length > 1) return `${adlar.join(" ve ")} birinciliği paylaştı!`;
    return yok;
}

function TurSonucTablosu({ oyun, sonuclar, benId }: { oyun: TurGorunumu["oyun"]; sonuclar: SonucSatiri[]; benId: string }) {
    return (
        <table className="result-table">
            <thead>
                <tr>
                    <th scope="col">Sıra</th>
                    <th scope="col">Oyuncu</th>
                    <th scope="col">Sonuç</th>
                    <th scope="col">Puan</th>
                </tr>
            </thead>
            <tbody>
                {sonuclar.map((s) => {
                    const metin = sonucMetni(oyun, s);
                    return (
                        <tr key={s.id} className={s.sira === 1 && s.turPuani > 0 ? "winner" : undefined}>
                            <td className="rank">{s.sira}</td>
                            <td>
                                <span className="row">
                                    <Avatar ad={s.ad} renk={s.renk} />
                                    <strong>{s.ad}{s.id === benId && " · Sen"}</strong>
                                </span>
                            </td>
                            <td>{metin ?? <span className="status-chip bad">{DURUM_ETIKETI[s.durum]}</span>}</td>
                            <td><strong>+{s.turPuani}</strong></td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function ToplamTablosu({ oda, benId }: { oda: OdaGorunumu; benId: string }) {
    return (
        <table className="result-table">
            <thead>
                <tr>
                    <th scope="col">Sıra</th>
                    <th scope="col">Oyuncu</th>
                    <th scope="col">Toplam</th>
                </tr>
            </thead>
            <tbody>
                {oda.toplamlar.map((t) => (
                    <tr key={t.id} className={t.sira === 1 ? "winner" : undefined}>
                        <td className="rank">{t.sira}</td>
                        <td>
                            <span className="row">
                                <Avatar ad={t.ad} renk={t.renk} />
                                <strong>{t.ad}{t.id === benId && " · Sen"}</strong>
                                {t.ayrildi && <span className="status-chip bad">Ayrıldı</span>}
                            </span>
                        </td>
                        <td><strong>{t.puan} puan</strong></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function TurSonucu({ oda, benId, gonder, baglanti, simdi }: Ortak) {
    const sonuclar = oda.turSonuclari ?? [];
    const oyun = oda.oyunlar![oda.oyunNo];
    const sonraki = oda.oyunlar![oda.oyunNo + 1];
    const kalan = Math.max(0, Math.ceil(((oda.araBitis ?? simdi) - simdi) / 1000));
    const birinciler = sonuclar.filter((s) => s.sira === 1 && s.turPuani > 0).map((s) => s.ad);
    return (
        <div className="narrow">
            <div className="result-heading">
                <span className="result-mark" aria-hidden="true"><Ikon ad="trophy" /></span>
                <span className="eyebrow muted">{oyunNoYaz(oda)} · {oyunKarti(oyun).ad}</span>
                <h1 className="spaced">{kazananBasligi(birinciler, (ad) => `Bu oyunun yıldızı ${ad}!`, "Bu oyunda kimse puan alamadı.")}</h1>
            </div>
            <div className="panel">
                <TurSonucTablosu oyun={oyun} sonuclar={sonuclar} benId={benId} />
            </div>
            <div className="panel spaced">
                <h2>Toplam puan</h2>
                <ToplamTablosu oda={oda} benId={benId} />
            </div>
            <div className="state-strip" role="status">
                <strong>Sıradaki: {oyunKarti(sonraki).ad}</strong>
                <p>{kalan} saniye sonra herkeste aynı anda başlıyor.</p>
                {oda.sahipId === benId && (
                    <button type="button" className="btn primary" onClick={() => gonder({ t: "devam" })} disabled={baglanti !== "acik"}>
                        Hemen başlat <Ikon ad="arrow" />
                    </button>
                )}
            </div>
            <div className="result-actions">
                <button type="button" className="text-link" onClick={() => gonder({ t: "ayril" })}>Oturumdan ayrıl</button>
            </div>
        </div>
    );
}

function OturumSonucu({ oda, benId, gonder, baglanti }: Ortak) {
    const birinciler = oda.toplamlar.filter((t) => t.sira === 1).map((t) => t.ad);
    const sonOyun = oda.oyunlar?.[oda.oyunNo];
    return (
        <div className="narrow">
            <div className="result-heading">
                <span className="result-mark" aria-hidden="true"><Ikon ad="trophy" /></span>
                <span className="eyebrow muted">Oturum tamamlandı</span>
                <h1 className="spaced">{kazananBasligi(birinciler, (ad) => `Oturumun yıldızı ${ad}!`, "Oturum bitti.")}</h1>
                <p>{oda.oyunlar?.slice(0, oda.oyunNo + 1).map((o) => oyunKarti(o).ad).join(" · ")}</p>
            </div>
            <div className="panel">
                <ToplamTablosu oda={oda} benId={benId} />
                <p className="note spaced">Her oyunda birinci oyuncu sayısı kadar puan aldı, sonuncu 1 puan. Kopan veya ayrılan o oyundan puan alamadı.</p>
            </div>
            {oda.turSonuclari && sonOyun && (
                <details className="panel spaced">
                    <summary>Son oyun: {oyunKarti(sonOyun).ad}</summary>
                    <TurSonucTablosu oyun={sonOyun} sonuclar={oda.turSonuclari} benId={benId} />
                </details>
            )}
            <div className="result-actions">
                <button type="button" className="btn primary" onClick={() => gonder({ t: "yeni_oturum" })} disabled={baglanti !== "acik"}>
                    Aynı ekiple yeni oturum
                </button>
                <button type="button" className="btn secondary" onClick={() => gonder({ t: "ayril" })}>
                    Oturumdan ayrıl
                </button>
            </div>
        </div>
    );
}

// ── Terminal states ───────────────────────────────────────────────────────

function SonEkrani({ son, yenidenDene }: { son: Son; yenidenDene: () => void }) {
    let baslik = "Oturum kapandı.";
    let metin = "Yeni bir oturum açabilir ya da başka bir kodla katılabilirsin.";
    let tekrar: string | null = null;
    if (son.tur === "katilamadi") {
        switch (son.kod) {
            case "yok":
            case "gecersiz":
                baslik = "Bu kodla açık bir oturum bulamadık.";
                metin = "Kod yanlış olabilir veya oturum kapanmış olabilir. Ailenin paylaştığı kodu yeniden kontrol et.";
                break;
            case "dolu":
                baslik = "Bu oturum dolu.";
                metin = `Bir oturumda en fazla ${ODA_KAPASITESI} kişi oynayabilir.`;
                break;
            case "tur_suruyor":
                baslik = "Bu oturum başladı bile.";
                metin = "Oyunlar bitince oturuma katılabilir, bir sonrakinde birlikte oynayabilirsiniz.";
                tekrar = "Tekrar dene";
                break;
            case "kesildi":
                baslik = "Bu oturum yarıda kesildi.";
                metin = "Sunucu yeniden başladığı için oturum yarıda kaldı. Yeni bir oturum açıp tekrar oynayabilirsiniz.";
                break;
        }
    } else if (son.sebep === "baska_yerde") {
        baslik = "Bu oturumu başka bir yerde açtın.";
        metin = "Aynı hesapla başka bir sekmede veya cihazda bu oturumdasın. Buradan devam etmek istersen oturumu buraya al.";
        tekrar = "Buraya al";
    } else if (son.sebep === "ayrildin") {
        baslik = "Oturumdan ayrıldın.";
    }
    return (
        <div className="panel form-card" role="status">
            <h1>{baslik}</h1>
            <p className="muted spaced">{metin}</p>
            <div className="stack spaced">
                {tekrar && <button type="button" className="btn primary" onClick={yenidenDene}>{tekrar}</button>}
                <Link className={tekrar ? "btn secondary" : "btn primary"} href="/katil">Başka kod gir</Link>
                <Link className="text-link" href="/oyna">Oyunlara dön</Link>
            </div>
        </div>
    );
}
