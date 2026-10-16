import { redirect } from "next/navigation";

// Links shared before rooms became sessions still work.
export default async function EskiOdaAdresi({ params }: { params: Promise<{ kod: string }> }) {
    redirect(`/oturum/${encodeURIComponent((await params).kod)}`);
}
