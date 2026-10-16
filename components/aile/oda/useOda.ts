"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
    BenimTurum,
    IlerlemeGorunumu,
    IslemHatasi,
    IstemciMesaji,
    KatilmaHatasi,
    OdaGorunumu,
    SunucuMesaji,
} from "@/lib/aile/tipler";

// One WebSocket per room page: reconnects on its own, estimates the server
// clock offset, and keeps the latest room snapshot.

export type BaglantiDurumu = "baglaniyor" | "acik" | "koptu";
export type Son =
    | { tur: "katilamadi"; kod: KatilmaHatasi }
    | { tur: "kapandi"; sebep: "ayrildin" | "baska_yerde" | "oda_kapandi" };

export interface HamleYaniti {
    turId: string;
    sira: number;
    kabul: boolean;
    ben: BenimTurum;
}

const YENIDEN_BAGLANMA_MS = [500, 1000, 2000, 3000, 5000];
const PING_ARALIGI_MS = 10_000;

export function useOda(kod: string, hamleYaniti: (y: HamleYaniti) => void) {
    const [oda, setOda] = useState<OdaGorunumu | null>(null);
    const [benId, setBenId] = useState<string | null>(null);
    const [baglanti, setBaglanti] = useState<BaglantiDurumu>("baglaniyor");
    const [son, setSon] = useState<Son | null>(null);
    const [islemHatasi, setIslemHatasi] = useState<IslemHatasi | null>(null);
    const [deneme, setDeneme] = useState(0);

    const soketRef = useRef<WebSocket | null>(null);
    const saatFarkiRef = useRef(0);
    const enIyiGecikmeRef = useRef(Infinity);
    const hamleYanitiRef = useRef(hamleYaniti);
    hamleYanitiRef.current = hamleYaniti;
    const sonRef = useRef<Son | null>(null);
    const denemeSayisiRef = useRef(0);

    const sunucuZamani = useCallback(() => Date.now() + saatFarkiRef.current, []);

    const gonder = useCallback((mesaj: IstemciMesaji) => {
        const soket = soketRef.current;
        if (soket?.readyState === WebSocket.OPEN) {
            soket.send(JSON.stringify(mesaj));
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (sonRef.current) return;
        let kapatildi = false;
        let pingZamanlayici: ReturnType<typeof setInterval> | undefined;
        let yenidenZamanlayici: ReturnType<typeof setTimeout> | undefined;
        const ilkPingler: ReturnType<typeof setTimeout>[] = [];

        const protokol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const soket = new WebSocket(`${protokol}//${window.location.host}/ws?oda=${encodeURIComponent(kod)}`);
        soketRef.current = soket;
        setBaglanti("baglaniyor");

        const ping = () => {
            if (soket.readyState === WebSocket.OPEN) soket.send(JSON.stringify({ t: "ping", c: Date.now() }));
        };

        soket.onopen = () => {
            denemeSayisiRef.current = 0;
            setBaglanti("acik");
            // A quick burst gives a good first offset; then refresh slowly.
            for (let i = 0; i < 5; i++) ilkPingler.push(setTimeout(ping, i * 250));
            pingZamanlayici = setInterval(ping, PING_ARALIGI_MS);
        };

        soket.onmessage = (olay) => {
            let m: SunucuMesaji;
            try {
                m = JSON.parse(String(olay.data));
            } catch {
                return;
            }
            switch (m.t) {
                case "pong": {
                    const simdi = Date.now();
                    const gecikme = simdi - m.c;
                    // Keep the sample with the smallest round trip; it is the least skewed.
                    if (gecikme <= enIyiGecikmeRef.current + 20) {
                        enIyiGecikmeRef.current = Math.min(enIyiGecikmeRef.current, gecikme);
                        saatFarkiRef.current = m.s - (m.c + simdi) / 2;
                    }
                    break;
                }
                case "durum":
                    setBenId(m.benId);
                    setOda(m.oda);
                    setIslemHatasi(null);
                    break;
                case "ilerleme":
                    setOda((onceki) =>
                        onceki?.tur?.id === m.turId
                            ? { ...onceki, tur: { ...onceki.tur, ilerlemeler: m.ilerlemeler as IlerlemeGorunumu[] } }
                            : onceki
                    );
                    break;
                case "hamle_sonucu":
                    hamleYanitiRef.current(m);
                    break;
                case "hata":
                    setIslemHatasi(m.kod);
                    break;
                case "katilamadi":
                    sonRef.current = { tur: "katilamadi", kod: m.kod };
                    setSon(sonRef.current);
                    break;
                case "kapandi":
                    sonRef.current = { tur: "kapandi", sebep: m.sebep };
                    setSon(sonRef.current);
                    break;
            }
        };

        soket.onclose = () => {
            ilkPingler.forEach(clearTimeout);
            clearInterval(pingZamanlayici);
            if (kapatildi || sonRef.current) return;
            setBaglanti("koptu");
            const bekle = YENIDEN_BAGLANMA_MS[Math.min(denemeSayisiRef.current++, YENIDEN_BAGLANMA_MS.length - 1)];
            yenidenZamanlayici = setTimeout(() => setDeneme((d) => d + 1), bekle);
        };

        // Coming back from a locked screen: reconnect now instead of after backoff.
        const gorunurluk = () => {
            if (document.visibilityState === "visible" && soket.readyState === WebSocket.CLOSED && !sonRef.current) {
                clearTimeout(yenidenZamanlayici);
                setDeneme((d) => d + 1);
            }
        };
        document.addEventListener("visibilitychange", gorunurluk);

        return () => {
            kapatildi = true;
            ilkPingler.forEach(clearTimeout);
            clearInterval(pingZamanlayici);
            clearTimeout(yenidenZamanlayici);
            document.removeEventListener("visibilitychange", gorunurluk);
            soket.close();
        };
    }, [kod, deneme]);

    /** Start over after a terminal state (e.g. "take over here" or "try again"). */
    const yenidenDene = useCallback(() => {
        sonRef.current = null;
        setSon(null);
        setDeneme((d) => d + 1);
    }, []);

    return { oda, benId, baglanti, son, islemHatasi, gonder, sunucuZamani, yenidenDene };
}
