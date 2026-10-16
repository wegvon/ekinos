import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { Duplex } from "node:stream";
import next from "next";
import { WebSocketServer } from "ws";
import { cerezdenToken, oturumKullanicisi } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { kaynakGecerli, istemciAdresi, sinir } from "@/lib/server/guvenlik";
import { aileDeposu } from "@/lib/aile/depo";
import { odaYoneticisiniKur } from "@/lib/aile/yonetici";

// Single process: Next.js pages and API, the family room WebSocket on /ws,
// in-memory rooms and the SQLite file. See Dockerfile for production.

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3003);
const hostname = process.env.HOSTNAME || "0.0.0.0";

export async function sunucuyuBaslat(opts: { dev: boolean; port: number; hostname: string }) {
    const yonetici = odaYoneticisiniKur(aileDeposu(getDb()));
    // Next attaches its own "upgrade" listener to whatever server it is given
    // and would end our /ws sockets. It gets a stand-in emitter instead, and
    // only non-room upgrades (dev hot reload) are forwarded to it.
    const nextIcinSunucu = new EventEmitter();
    const app = next({
        dev: opts.dev,
        // Development used `next dev --turbopack`; the site's Tailwind setup relies on it.
        turbopack: opts.dev,
        hostname: opts.hostname,
        port: opts.port,
        httpServer: nextIcinSunucu as unknown as Server,
    });
    const handle = app.getRequestHandler();
    await app.prepare();

    const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
    const server = createServer((req, res) => handle(req, res));

    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(req.url ?? "/", "http://yerel");
        if (url.pathname !== "/ws") {
            nextIcinSunucu.emit("upgrade", req, socket, head);
            return;
        }
        const reddet = (durum: number, metin: string) => {
            socket.write(`HTTP/1.1 ${durum} ${metin}\r\nConnection: close\r\n\r\n`);
            socket.destroy();
        };
        if (!kaynakGecerli(req.headers)) return reddet(403, "Forbidden");
        const kullanici = oturumKullanicisi(cerezdenToken(req.headers.cookie));
        if (!kullanici) return reddet(401, "Unauthorized");
        if (kullanici.sifreDegismeli) return reddet(403, "Forbidden");
        if (!sinir("odaKodu").dene(`${istemciAdresi(req.headers)}:${kullanici.id}`)) {
            return reddet(429, "Too Many Requests");
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            const baglantiId = yonetici.baglan(
                ws,
                { id: kullanici.id, ad: kullanici.kullaniciAdi, renk: kullanici.avatarRenk },
                url.searchParams.get("oda") ?? ""
            );
            if (!baglantiId) return;
            ws.on("message", (veri, ikili) => {
                if (!ikili) yonetici.mesaj(baglantiId, veri.toString());
            });
            ws.on("close", () => yonetici.kapandi(baglantiId));
            ws.on("error", () => ws.terminate());
        });
    });

    await new Promise<void>((resolve) => server.listen(opts.port, opts.hostname, resolve));
    return { server, yonetici, app };
}

if (process.env.EKINOS_SUNUCU_TEST !== "1") {
    sunucuyuBaslat({ dev, port, hostname }).then(() => {
        console.log(`> Ekinos hazır: http://${hostname}:${port} (${dev ? "geliştirme" : "üretim"})`);
    });
}
