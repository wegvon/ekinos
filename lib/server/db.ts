import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// One SQLite file on a persistent volume holds accounts, sessions, finished
// family rounds and the legacy single-player leaderboard.
// The handle lives on globalThis so the custom server and Next route bundles
// share it in the same process.

type Db = Database.Database;

const globalForDb = globalThis as unknown as { __ekinosDb?: Db };

export function veritabaniYolu() {
    return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "ekinos.db");
}

export function migrasyonlariUygula(db: Db, klasor = path.join(process.cwd(), "drizzle")) {
    db.exec(`CREATE TABLE IF NOT EXISTS _migrasyonlar (
        ad TEXT PRIMARY KEY,
        uygulandi INTEGER NOT NULL
    )`);
    const uygulananlar = new Set(
        db.prepare("SELECT ad FROM _migrasyonlar").all().map((row) => (row as { ad: string }).ad)
    );
    const dosyalar = fs.readdirSync(klasor).filter((ad) => ad.endsWith(".sql")).sort();
    for (const ad of dosyalar) {
        if (uygulananlar.has(ad)) continue;
        const sql = fs.readFileSync(path.join(klasor, ad), "utf8");
        db.transaction(() => {
            db.exec(sql);
            db.prepare("INSERT INTO _migrasyonlar (ad, uygulandi) VALUES (?, ?)").run(ad, Date.now());
        })();
    }
}

export function veritabaniAc(dosya: string) {
    if (dosya !== ":memory:") {
        fs.mkdirSync(path.dirname(dosya), { recursive: true });
    }
    const db = new Database(dosya);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrasyonlariUygula(db);
    // A process restart loses in-memory rooms; rounds that were still running
    // are recorded as interrupted, never as completed.
    db.prepare("UPDATE aile_turlari SET durum = 'kesildi' WHERE durum = 'suruyor'").run();
    return db;
}

export function getDb(): Db {
    if (!globalForDb.__ekinosDb) {
        globalForDb.__ekinosDb = veritabaniAc(veritabaniYolu());
    }
    return globalForDb.__ekinosDb;
}

/** Test hook: point the shared handle at a specific database. */
export function setDb(db: Db) {
    globalForDb.__ekinosDb = db;
}

// The legacy leaderboard routes were written against Cloudflare D1. This keeps
// their query code unchanged on top of better-sqlite3.
export function getD1Uyumlu() {
    const db = getDb();
    return {
        prepare(query: string) {
            const stmt = db.prepare(query);
            return {
                bind(...values: unknown[]) {
                    const params = values.map((value) =>
                        typeof value === "boolean" ? Number(value) : value
                    );
                    return {
                        async all() {
                            return {
                                results: stmt.reader
                                    ? (stmt.all(...params) as Record<string, unknown>[])
                                    : (stmt.run(...params), []),
                            };
                        },
                        async first() {
                            if (!stmt.reader) {
                                stmt.run(...params);
                                return null;
                            }
                            return (stmt.get(...params) as Record<string, unknown> | undefined) ?? null;
                        },
                        async run() {
                            return stmt.reader ? stmt.all(...params) : stmt.run(...params);
                        },
                    };
                },
            };
        },
    };
}
