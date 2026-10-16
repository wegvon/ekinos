"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { oyunKarti, sureYaz } from "@/lib/aile/katalog";
import { SAYI_AVI_CEZA_MS, sayiAvi } from "@/lib/aile/oyunlar/sayi-avi";
import {
    ODA_EN_AZ_OYUNCU,
    ODA_KAPASITESI,
    type BenimTurum,
    type IlerlemeGorunumu,
    type IslemHatasi,
    type OdaGorunumu,
    type OyuncuGorunumu,
    type SonucSatiri,
    type TurGorunumu,
} from "@/lib/aile/tipler";
import { Avatar, Ikon } from "../Ikon";
import { useOda, type HamleYaniti, type Son } from "./useOda";

// The whole room lives on one page: lobby → countdown → board → results.

interface YerelTur {
    turId: string;
    beklenen: number;
    hatalar: number;
    sira: number;
    bitti: boolean;
}

function yereldenSunucuya(turId: string, ben: BenimTurum): YerelTur {
    return { turId, beklenen: ben.beklenen, hatalar: ben.hatalar, sira: ben.sonSira, bitti: ben.bitti };
}

const ISLEM_HATALARI: Record<IslemHatasi, string> = {
    yetki_yok: "Bunu yalnızca oda sahibi yapabilir.",
    gecersiz_asama: "Bu adım şu anda yapılamıyor.",
    az_oyuncu: `Başlamak için en az ${ODA_EN_AZ_OYUNCU} bağlı oyuncu gerekiyor.`,
    hazir_degil: "Herkes hazır olunca başlatabilirsin.",
    gecersiz_oyun: "Bu oyun için aile modu yok.",
    cok_hizli: "Çok hızlı dokunuyorsun; birkaç dokunuş sayılmadı.",
};

export function OdaIstemci({ kod, benAdi }: { kod: string; benAdi: string }) {
    const router = useRouter();
    const [yerel, setYerel] = useState<YerelTur | null>(null);
    const [yanlis, setYanlis] = useState<number | null>(null);

    const hamleYaniti = useCallback((y: HamleYaniti) => {
        setYerel((onceki) => {
            if (!onceki || onceki.turId !== y.turId) return onceki;
            // A rejected move, or the reply to our latest move, is the truth.
            if (!y.kabul || y.sira >= onceki.sira) return yereldenSunucuya(y.turId, y.ben);
            return onceki;
        });
    }, []);

    const { oda, benId, baglanti, son, islemHatasi, gonder, sunucuZamani, yenidenDene } = useOda(kod, hamleYaniti);
    const simdi = useSunucuSaati(sunucuZamani, !!oda?.tur);

    // Adopt the server's view of our board on a new round or after reconnecting.
    const tur = oda?.tur ?? null;
    useEffect(() => {
        if (!tur?.ben) return;
        setYerel((onceki) =>
            !onceki || onceki.turId !== tur.id || tur.ben!.sonSira >= onceki.sira
                ? yereldenSunucuya(tur.id, tur.ben!)
                : onceki
        );
    }, [tur?.id, tur?.ben]);

    useEffect(() => {
        if (son?.tur === "kapandi" && son.sebep === "ayrildin") router.push("/oyna");
    }, [son, router]);

    // Remember a cancelled countdown so the lobby can say why.
    const oncekiAsama = useRef(oda?.asama);
    const [iptalNotu, setIptalNotu] = useState(false);
    useEffect(() => {
        if (oncekiAsama.current === "geri_sayim" && oda?.asama === "bekleme") setIptalNotu(true);
        if (oda?.asama !== "bekleme") setIptalNotu(false);
        oncekiAsama.current = oda?.asama;
    }, [oda?.asama]);

    const dokun = useCallback(
        (deger: number) => {
            if (!tur || !yerel || yerel.turId !== tur.id || yerel.bitti || baglanti !== "acik") return;
            const zaman = sunucuZamani();
            if (zaman < tur.baslangic || zaman >= tur.bitis || tur.ben?.disarida) return;
            if (deger < yerel.beklenen) return;
            const sonuc = sayiAvi.hamleUygula(
                { beklenen: yerel.beklenen, hatalar: yerel.hatalar, bitisMs: null },
                deger,
                zaman - tur.baslangic,
                tur.icerik
            );
            const sira = yerel.sira + 1;
            if (!gonder({ t: "hamle", turId: tur.id, sira, deger })) return;
            setYerel({
                turId: tur.id,
                sira,
                beklenen: sonuc.durum.beklenen,
                hatalar: sonuc.durum.hatalar,
                bitti: sonuc.durum.bitisMs !== null,
            });
            if (deger > yerel.beklenen) {
                setYanlis(deger);
                setTimeout(() => setYanlis((y) => (y === deger ? null : y)), 300);
            }
        },
        [tur, yerel, baglanti, gonder, sunucuZamani]
    );

    if (son) return <SonEkrani son={son} yenidenDene={yenidenDene} />;
    if (!oda || !benId) {
        return (
            <div className="narrow panel" aria-live="polite">
                <span className="chip outline">Oda · {kod}</span>
                <h1 className="spaced">{baglanti === "koptu" ? "Bağlanamadık, tekrar deniyoruz." : "Odaya bağlanıyoruz…"}</h1>
            </div>
        );
    }

    const ben = oda.oyuncular.find((o) => o.id === benId);
    const ortak = { oda, benId, gonder, baglanti };

    return (
        <>
            {baglanti !== "acik" && (
                <p className="banner warn" role="status">
                    <strong>Seni yeniden bağlıyoruz.</strong>{" "}
                    {oda.asama === "oynaniyor" ? "Turun süresi devam ediyor; bu sırada dokunuşlar kapalı." : "Bağlantın dönünce kaldığın yerden devam edeceksin."}
                </p>
            )}
            {islemHatasi && <p className="banner warn" role="alert">{ISLEM_HATALARI[islemHatasi]}</p>}

            {oda.asama === "bekleme" && <Bekleme {...ortak} iptalNotu={iptalNotu} />}
            {(oda.asama === "geri_sayim" || oda.asama === "oynaniyor") && tur && (
                ben?.turDisinda || !tur.ben ? (
                    <TurDisinda oda={oda} tur={tur} benId={benId} />
                ) : simdi < tur.baslangic ? (
                    <GeriSayim oda={oda} kalanMs={tur.baslangic - simdi} />
                ) : tur.ben.bitti || tur.ben.disarida || yerel?.bitti ? (
                    <BitirdinBekle oda={oda} tur={tur} benId={benId} benAdi={benAdi} ben={tur.ben} />
                ) : (
                    <Oyun
                        {...ortak}
                        tur={tur}
                        yerel={yerel}
                        yanlis={yanlis}
                        kalanMs={tur.bitis - simdi}
                        dokun={dokun}
                    />
                )
            )}
            {oda.asama === "sonuc" && <Sonuclar {...ortak} />}
        </>
    );
}

/** Re-renders on a short interval while a round is on screen. */
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
}

// ── Lobby ──────────────────────────────────────────────────────────────────

function Bekleme({ oda, benId, gonder, baglanti, iptalNotu }: Ortak & { iptalNotu: boolean }) {
    const ben = oda.oyuncular.find((o) => o.id === benId)!;
    const sahibim = oda.sahipId === benId;
    const bagli = oda.oyuncular.filter((o) => o.bagli);
    const herkesHazir = bagli.length >= ODA_EN_AZ_OYUNCU && bagli.every((o) => o.hazir);
    const karti = oyunKarti(oda.oyun);
    const sahip = oda.oyuncular.find((o) => o.sahip);
    const acik = baglanti === "acik";

    let baslatNotu = "Turu başlattığında herkes aynı geri sayımı görecek.";
    if (bagli.length < ODA_EN_AZ_OYUNCU) baslatNotu = "En az bir kişinin daha katılması gerekiyor.";
    else if (!herkesHazir) baslatNotu = "Herkes “Hazırım” deyince başlatabilirsin.";

    return (
        <>
            <div className="page-title">
                <div>
                    <span className="eyebrow muted">Oyun odası</span>
                    <h1 className="spaced">{oda.ad ?? `${sahip?.ad ?? "Ailenin"} odası`}</h1>
                    <p>{sahibim ? "Kodu paylaş, herkes gelince birlikte başlayın." : `${sahip?.ad ?? "Oda sahibi"} turu başlatacak. Hazır olunca haber ver.`}</p>
                </div>
                <span className="chip green"><span className="dot" />{oda.oyuncular.length} / {ODA_KAPASITESI} oyuncu</span>
            </div>
            {iptalNotu && (
                <p className="banner info" role="status">Geri sayım durdu: bir oyuncunun bağlantısı koptu ya da ayrıldı. Yeniden hazır olun.</p>
            )}
            <div className="room-layout">
                <div className="panel">
                    <OdaKodu kod={oda.kod} />
                    <div className="section-heading">
                        <h2>Masadakiler</h2>
                        {herkesHazir && <span className="chip green">Herkes hazır</span>}
                    </div>
                    <div className="player-list" aria-live="polite">
                        {oda.oyuncular.map((o) => <OyuncuSatiri key={o.id} oyuncu={o} benim={o.id === benId} />)}
                    </div>
                </div>
                <aside className="panel room-settings">
                    <span className="eyebrow muted">Sıradaki oyun</span>
                    <div className="room-game">
                        <h3>{karti.ad}</h3>
                        <p>1’den 25’e, sırayla.<br />90 saniye · Yanlış dokunuş +2 sn</p>
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
                                Hep birlikte başlayalım <Ikon ad="arrow" />
                            </button>
                            <p className="note spaced">{baslatNotu}</p>
                        </>
                    )}
                    <div className="room-tip">
                        <strong>Aynı oyun, kendi ekranın.</strong>Telefonu elden ele dolaştırmaya gerek yok. Herkes kendi cihazından oynasın.
                    </div>
                    <button type="button" className="text-link spaced" onClick={() => gonder({ t: "ayril" })}>
                        Odadan ayrıl
                    </button>
                </aside>
            </div>
        </>
    );
}

function OdaKodu({ kod }: { kod: string }) {
    const [kopyalandi, setKopyalandi] = useState(false);
    async function paylas() {
        const url = `${window.location.origin}/oda/${kod}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: "Ekinos odası", text: `Oda kodu: ${kod}`, url });
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
                <strong aria-label={`Oda kodu ${kod.split("").join(" ")}`}>{kod}</strong>
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
                <small>{oyuncu.sahip ? "Oda sahibi" : "Oyuncu"}</small>
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

function GeriSayim({ oda, kalanMs }: { oda: OdaGorunumu; kalanMs: number }) {
    const sayi = Math.min(3, Math.max(1, Math.ceil(kalanMs / 1000)));
    return (
        <div className="narrow countdown-card">
            <div>
                <span className="chip green">{oyunKarti(oda.oyun).ad} · {oda.tur?.ilerlemeler.length ?? 0} oyuncu</span>
                <h1 className="spaced">Gözler ekranda.</h1>
                <div className="countdown-number" role="timer" aria-live="assertive">{sayi}</div>
                <p className="muted">Birazdan herkes aynı anda başlıyor.</p>
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
    tur,
    yerel,
    yanlis,
    kalanMs,
    dokun,
}: Ortak & {
    tur: TurGorunumu;
    yerel: YerelTur | null;
    yanlis: number | null;
    kalanMs: number;
    dokun: (deger: number) => void;
}) {
    const [ayrilOnayi, setAyrilOnayi] = useState(false);
    const beklenen = yerel?.beklenen ?? 1;
    const kapali = baglanti !== "acik";
    return (
        <div className="arena">
            <div>
                <div className="game-stage">
                    <div className="game-status">
                        <div>
                            {oda.ad && <span className="eyebrow muted">{oda.ad}</span>}
                            <h1>Sayı Avı</h1>
                        </div>
                        <span className="timer" role="timer" aria-label="Kalan süre">{sayac(kalanMs)}</span>
                    </div>
                    <div className="game-target">
                        <span>Sıradaki sayı <strong>{beklenen}</strong></span>
                        <span>{beklenen - 1} / 25 buldun{yerel?.hatalar ? ` · ${yerel.hatalar} hata` : ""}</span>
                    </div>
                    <div className="board-wrap">
                        <div className="number-board" role="group" aria-label="Sayı tahtası" aria-disabled={kapali}>
                            {tur.icerik.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className={n === beklenen - 1 ? "last" : n < beklenen ? "complete" : n === yanlis ? "wrong" : undefined}
                                    onPointerDown={(e) => {
                                        // Respond on touch-down; the click that follows is ignored.
                                        if (e.pointerType !== "mouse" || e.button === 0) dokun(n);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            dokun(n);
                                        }
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        {kapali && <div className="board-cover" role="status">Bağlantı bekleniyor…</div>}
                    </div>
                    <p className="game-caption">1’den 25’e sırayla dokun. Yanlış dokunuş sonucuna 2 sn ekler.</p>
                </div>
                <div className="game-exit">
                    {ayrilOnayi ? (
                        <div className="state-strip" role="alertdialog" aria-label="Odadan ayrılma onayı">
                            <strong>Odadan ayrılalım mı?</strong>
                            <p>Bu turdaki sonucun “ayrıldı” olarak görünür. Diğerleri oynamaya devam eder.</p>
                            <div className="row wrap">
                                <button type="button" className="btn primary" onClick={() => setAyrilOnayi(false)}>Oyunda kal</button>
                                <button type="button" className="btn secondary" onClick={() => gonder({ t: "ayril" })}>Evet, ayrıl</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className="text-link" onClick={() => setAyrilOnayi(true)}>Odadan ayrıl</button>
                    )}
                </div>
            </div>
            <IlerlemeListesi oda={oda} benId={benId} ilerlemeler={tur.ilerlemeler} benimIlerleme={beklenen - 1} />
        </div>
    );
}

function IlerlemeListesi({
    oda,
    benId,
    ilerlemeler,
    benimIlerleme,
}: {
    oda: OdaGorunumu;
    benId: string;
    ilerlemeler: IlerlemeGorunumu[];
    benimIlerleme?: number;
}) {
    return (
        <aside className="progress-list" aria-label="Oyuncuların ilerlemesi">
            <h2>Aynı anda oynuyoruz</h2>
            {ilerlemeler.map((i) => {
                const oyuncu = oda.oyuncular.find((o) => o.id === i.id);
                const benim = i.id === benId;
                const deger = benim && benimIlerleme !== undefined ? Math.max(benimIlerleme, i.ilerleme) : i.ilerleme;
                const ad = oyuncu?.ad ?? "Ayrılan oyuncu";
                return (
                    <div key={i.id} className={benim ? "progress-player self" : "progress-player"}>
                        <div className="progress-head">
                            <Avatar ad={ad} renk={oyuncu?.renk ?? "#e2e5d9"} />
                            <strong>{ad}{benim && " · Sen"}</strong>
                            <span>
                                {i.disarida === "koptu" ? "Koptu" : i.disarida === "ayrildi" ? "Ayrıldı" : i.bitti ? "Bitirdi" : `${deger} / ${i.toplam}`}
                            </span>
                        </div>
                        <div className="track"><span style={{ width: `${(deger / i.toplam) * 100}%` }} /></div>
                    </div>
                );
            })}
        </aside>
    );
}

function BitirdinBekle({ oda, tur, benId, benAdi, ben }: { oda: OdaGorunumu; tur: TurGorunumu; benId: string; benAdi: string; ben: BenimTurum }) {
    const devamEdenler = tur.ilerlemeler.filter((i) => !i.bitti && !i.disarida).length;
    const baslik = ben.disarida === "koptu" ? "Bağlantın uzun süre koptu." : ben.bitti ? `Güzel turdu, ${benAdi}.` : "Sonucun kesinleşiyor…";
    return (
        <div className="arena">
            <div className="panel" aria-live="polite">
                <span className="chip green"><Ikon ad="check" />{ben.bitti ? "Sen tamamladın" : "Tur sürüyor"}</span>
                <h1 className="spaced">{baslik}</h1>
                {ben.bitti && (
                    <p className="muted spaced">
                        Sonucun: {sureYaz(ben.nihaiMs)}
                        {ben.hatalar > 0 && ` (${sureYaz(ben.hamMs)} + ${ben.hatalar} hata × ${SAYI_AVI_CEZA_MS / 1000} sn)`}.
                    </p>
                )}
                {ben.disarida === "koptu" && <p className="muted spaced">Bu turda “bağlantı koptu” olarak görüneceksin. Tur bitince sonuçları birlikte göreceksiniz.</p>}
                <div className="state-strip">
                    <strong>{devamEdenler > 0 ? "Diğer oyuncular bekleniyor" : "Sonuçlar hazırlanıyor"}</strong>
                    <p>Turun 90 saniyelik süresi dolunca sonuçlar otomatik açılır.</p>
                </div>
            </div>
            <IlerlemeListesi oda={oda} benId={benId} ilerlemeler={tur.ilerlemeler} />
        </div>
    );
}

function TurDisinda({ oda, tur, benId }: { oda: OdaGorunumu; tur: TurGorunumu; benId: string }) {
    return (
        <div className="arena">
            <div className="panel">
                <span className="chip outline">Tur sürüyor</span>
                <h1 className="spaced">Bu tur sensiz başladı.</h1>
                <p className="muted spaced">Tur bitince sonuçları birlikte göreceksiniz; bir sonraki elde sen de varsın.</p>
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

function Sonuclar({ oda, benId, gonder, baglanti }: Ortak) {
    const sonuclar = oda.sonuclar ?? [];
    const kazananlar = sonuclar.filter((s) => s.sira === 1 && s.durum === "bitirdi").map((s) => s.ad);
    const baslik =
        kazananlar.length === 1
            ? `Bu turun yıldızı ${kazananlar[0]}!`
            : kazananlar.length > 1
              ? `${kazananlar.join(" ve ")} birinciliği paylaştı!`
              : "Bu tur kimse bitiremedi.";
    return (
        <div className="narrow">
            <div className="result-heading">
                <span className="result-mark" aria-hidden="true"><Ikon ad="trophy" /></span>
                <span className="eyebrow muted">{oyunKarti(oda.oyun).ad} · Tur tamamlandı</span>
                <h1 className="spaced">{baslik}</h1>
                <p>Bir el daha? Her tur yeni bir şans.</p>
            </div>
            <div className="panel">
                <table className="result-table">
                    <caption className="muted" style={{ textAlign: "left", paddingBottom: 12, fontSize: 12 }}>
                        Düşük sonuç daha iyi
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Sıra</th>
                            <th scope="col">Oyuncu</th>
                            <th scope="col">Ham süre</th>
                            <th scope="col">Hata</th>
                            <th scope="col">Sonuç</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sonuclar.map((s) => (
                            <tr key={s.id} className={s.sira === 1 && s.durum === "bitirdi" ? "winner" : undefined}>
                                <td className="rank">{s.sira}</td>
                                <td>
                                    <span className="row">
                                        <Avatar ad={s.ad} renk={s.renk} />
                                        <strong>{s.ad}{s.id === benId && " · Sen"}</strong>
                                    </span>
                                </td>
                                <td>{s.durum === "bitirdi" ? sureYaz(s.hamMs) : `${s.ilerleme} / ${s.toplam}`}</td>
                                <td>{s.hata}</td>
                                <td>
                                    {s.durum === "bitirdi" ? (
                                        <strong>{sureYaz(s.nihaiMs)}</strong>
                                    ) : (
                                        <span className="status-chip bad">{DURUM_ETIKETI[s.durum]}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="note spaced">Sonuç = ham süre + her hata için 2 saniye. Bitiremeyenler bulduğu sayıya göre sıralanır.</p>
            </div>
            <div className="result-actions">
                <button type="button" className="btn primary" onClick={() => gonder({ t: "bir_el_daha" })} disabled={baglanti !== "acik"}>
                    Bir el daha
                </button>
                <button type="button" className="btn secondary" onClick={() => gonder({ t: "ayril" })}>
                    Odadan ayrıl
                </button>
            </div>
        </div>
    );
}

// ── Terminal states ───────────────────────────────────────────────────────

function SonEkrani({ son, yenidenDene }: { son: Son; yenidenDene: () => void }) {
    let baslik = "Oda kapandı.";
    let metin = "Yeni bir oda kurabilir ya da başka bir kodla katılabilirsin.";
    let tekrar: string | null = null;
    if (son.tur === "katilamadi") {
        switch (son.kod) {
            case "yok":
            case "gecersiz":
                baslik = "Bu kodla açık bir oda bulamadık.";
                metin = "Kod yanlış olabilir veya oda kapanmış olabilir. Ailenin paylaştığı kodu yeniden kontrol et.";
                break;
            case "dolu":
                baslik = "Bu oda dolu.";
                metin = `Bir odada en fazla ${ODA_KAPASITESI} kişi oynayabilir.`;
                break;
            case "tur_suruyor":
                baslik = "Tur sürüyor; birazdan tekrar dene.";
                metin = "Bu tur bitince odaya katılabilirsin.";
                tekrar = "Tekrar dene";
                break;
            case "kesildi":
                baslik = "Bu odadaki tur kesildi.";
                metin = "Sunucu yeniden başladığı için tur yarıda kaldı ve kaydedilmedi. Yeni bir oda kurup tekrar oynayabilirsiniz.";
                break;
        }
    } else if (son.sebep === "baska_yerde") {
        baslik = "Bu odayı başka bir yerde açtın.";
        metin = "Aynı hesapla başka bir sekmede veya cihazda bu odadasın. Buradan devam etmek istersen odayı buraya al.";
        tekrar = "Buraya al";
    } else if (son.sebep === "ayrildin") {
        baslik = "Odadan ayrıldın.";
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
