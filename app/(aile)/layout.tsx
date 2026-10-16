import type { Metadata, Viewport } from "next";
import { IkonSprite } from "@/components/aile/Ikon";
import "./aile.css";

// Root layout for the family app. Separate from the public site's shell:
// no analytics, ads, blog or footer.

export const metadata: Metadata = {
    title: { default: "Ekinos", template: "%s · Ekinos" },
    description: "Ailece, aynı anda oynanan kısa oyunlar.",
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#f5f3ed",
};

export default function AileKokDuzeni({ children }: { children: React.ReactNode }) {
    return (
        <html lang="tr">
            <body>
                <IkonSprite />
                {children}
            </body>
        </html>
    );
}
