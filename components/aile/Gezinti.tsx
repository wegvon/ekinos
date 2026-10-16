"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ikon, type IkonAdi } from "./Ikon";

const OGELER: { yol: string; ad: string; ikon: IkonAdi; eslesme: RegExp }[] = [
    { yol: "/oyna", ad: "Oyunlar", ikon: "grid", eslesme: /^\/oyna/ },
    { yol: "/katil", ad: "Katıl", ikon: "people", eslesme: /^\/(katil|oda|oturum)/ },
    { yol: "/profil", ad: "Profilim", ikon: "user", eslesme: /^\/profil/ },
];

export function Gezinti({ mobil }: { mobil?: boolean }) {
    const yol = usePathname();
    return (
        <nav className={mobil ? "mobile-nav" : "main-nav"} aria-label={mobil ? "Mobil ana menü" : "Ana menü"}>
            {OGELER.map((o) => (
                <Link key={o.yol} href={o.yol} aria-current={o.eslesme.test(yol) ? "page" : undefined}>
                    <Ikon ad={o.ikon} />
                    {o.ad}
                </Link>
            ))}
        </nav>
    );
}
