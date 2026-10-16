import { NextResponse, type NextRequest } from "next/server";
import { OTURUM_CEREZI, oturumKapat } from "@/lib/server/auth";
import { kaynakDenetimi, oturumCereziYaz } from "@/lib/server/istek";

export async function POST(req: NextRequest) {
    const red = kaynakDenetimi(req);
    if (red) return red;
    oturumKapat(req.cookies.get(OTURUM_CEREZI)?.value);
    return oturumCereziYaz(NextResponse.json({ ok: true }), null);
}
