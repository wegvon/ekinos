import { NextResponse, type NextRequest } from "next/server";
import { OTURUM_CEREZI, OTURUM_SURESI_MS, oturumKullanicisi } from "./auth";
import { kaynakGecerli } from "./guvenlik";

// Small helpers shared by the family API route handlers.

export function hataYaniti(hata: string, durum: number) {
    return NextResponse.json({ hata }, { status: durum, headers: { "Cache-Control": "no-store" } });
}

/** Rejects cross-site state changes; returns a response to send, or null to continue. */
export function kaynakDenetimi(req: NextRequest) {
    return kaynakGecerli(req.headers) ? null : hataYaniti("İstek reddedildi.", 403);
}

export async function jsonGovde(req: NextRequest): Promise<Record<string, unknown>> {
    try {
        const govde = await req.json();
        return govde && typeof govde === "object" ? (govde as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

export function istekKullanicisi(req: NextRequest) {
    return oturumKullanicisi(req.cookies.get(OTURUM_CEREZI)?.value);
}

export function oturumCereziYaz(yanit: NextResponse, token: string | null) {
    yanit.cookies.set(OTURUM_CEREZI, token ?? "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
        sameSite: "lax",
        path: "/",
        maxAge: token ? Math.floor(OTURUM_SURESI_MS / 1000) : 0,
    });
    return yanit;
}
