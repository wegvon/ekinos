// Operator tool: give a family member a temporary password.
//   npm run hesap:sifre-sifirla -- <kullanici_adi>            (development)
//   node dist/hesap-sifre-sifirla.js <kullanici_adi>          (container)
// Their sessions end and they must pick a new password at next sign-in.
import { geciciSifreAta } from "@/lib/server/auth";

const ad = process.argv[2];
if (!ad) {
    console.error("Kullanım: hesap-sifre-sifirla <kullanici_adi>");
    process.exit(1);
}
geciciSifreAta(ad).then((gecici) => {
    if (!gecici) {
        console.error(`"${ad}" adında bir hesap bulunamadı.`);
        process.exit(1);
    }
    console.log(`Geçici şifre: ${gecici}`);
    console.log("Kullanıcı ilk girişte yeni bir şifre seçecek; diğer oturumları kapatıldı.");
});
