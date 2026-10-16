"use client";

import { aileIstegi } from "./HesapFormu";

export function CikisDugmesi() {
    return (
        <button
            type="button"
            className="text-link"
            onClick={async () => {
                await aileIstegi("/api/aile/cikis", {});
                window.location.assign("/giris");
            }}
        >
            Çıkış yap
        </button>
    );
}
