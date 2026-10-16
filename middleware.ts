import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const handleI18nRouting = createMiddleware(routing);

const AILE_HESAP_YOLLARI = /^\/(giris|kayit|sifre)\/?$/;
const AILE_KORUNAN_YOLLAR = /^\/(oyna|katil|profil|oda|oturum)(\/|$)/;

export default async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Family app: its own Turkish routes, outside the locale-prefixed site.
    if (AILE_HESAP_YOLLARI.test(pathname)) {
        return NextResponse.next();
    }
    if (AILE_KORUNAN_YOLLAR.test(pathname)) {
        // Cheap early bounce; the server layout still validates the session.
        if (!request.cookies.has("ekinos_oturum")) {
            const giris = new URL("/giris", request.url);
            giris.searchParams.set("sonra", pathname);
            return NextResponse.redirect(giris);
        }
        return NextResponse.next();
    }

    // sitemap.xml 和 robots.txt 直接放行
    if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
        return NextResponse.next();
    }

    // This resource list has no Chinese translation; keep one indexable URL.
    if (/^\/(?:en|zh)\/partnerships$/.test(pathname)) {
        return NextResponse.redirect(new URL('/partnerships' + request.nextUrl.search, request.url), 301);
    }

    // Career Tests are intentionally English-only. Keep their public URLs
    // unprefixed and ignore any previously selected site-language cookie.
    if (/^\/(?:en|zh)\/career-tests(?:\/|$)/.test(pathname)) {
        const englishOnlyPath = pathname.replace(/^\/(?:en|zh)/, '') || '/career-tests';
        return NextResponse.redirect(
            new URL(englishOnlyPath + request.nextUrl.search, request.url),
            301
        );
    }

    if (/^\/career-tests(?:\/|$)/.test(pathname)) {
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = `/en${pathname}`;
        return NextResponse.rewrite(rewriteUrl);
    }

    // 检查路径是否以无效的语言前缀开头
    const pathSegments = pathname.split('/').filter(Boolean);

    if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0];

        // 定义已知的无效语言代码（之前支持但现在不支持的）
        const removedLanguageCodes = ['de', 'ja', 'es', 'ko', 'fr', 'jp'];

        if (removedLanguageCodes.includes(firstSegment)) {
            // 移除这些已知的无效语言前缀，重定向到正确的路径
            const newPath = '/' + pathSegments.slice(1).join('/');
            const searchParams = request.nextUrl.search;

            return NextResponse.redirect(new URL(newPath + searchParams, request.url), 301);
        }
    }

    // 让next-intl处理其余的路由逻辑
    return handleI18nRouting(request);
}

export const config = {
    // 匹配所有路径除了API、静态资源、sitemap.xml、robots.txt等
    matcher: [
        // 包含所有页面路径，但排除 sitemap.xml 和 robots.txt 以及常见的静态资源文件
        "/((?!api|ws|embedded|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|ogg|mp4|webm|txt|xml|json)$).*)",
    ],
};
