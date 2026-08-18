/** Marketplace domain records live in the Worker D1 binding.  Every collection
 * query is through an explicit status/seller index; there is no key scan. */
export type Condition = "Mint" | "Near Mint" | "Lightly Played" | "Played" | "Damaged";
export interface Listing {
  id: string; title: string; description: string; condition: Condition;
  photos: string[]; usdPrice: number; sellerId: number; status: "active" | "sold";
}
export interface User { telegramId: number; displayName: string; }
export interface Order {
  id: string; buyerId: number; listingId: string; ltcAmount: number;
  status: "awaiting_payment" | "paid" | "released" | "failed";
  createdAt: number; paidAt?: number; releaseAt?: number;
}
export interface Escrow { orderId: string; txId?: string; amount: number; fee: number; releaseStatus: "held" | "released"; }

export interface D1Statement { bind(...values: unknown[]): D1Statement; run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null>; }
export interface D1Database { prepare(sql: string): D1Statement; }
type EnvContext = object;

export const ESCROW_DAYS = 7;
export const PLATFORM_FEE_RATE = 0.1;
let clock: () => number = () => Date.now();
export const now = () => clock();
export const setNowForTests = (value?: () => number) => { clock = value ?? (() => Date.now()); };

/** Litecoin uses eight decimal places. This is the settlement calculation the
 * wallet integration must apply before sending a seller payout. */
export function escrowSettlement(amount: number): { fee: number; sellerPayout: number } {
  const fee = Number((amount * PLATFORM_FEE_RATE).toFixed(8));
  return { fee, sellerPayout: Number((amount - fee).toFixed(8)) };
}

function db(ctx: EnvContext): D1Database | undefined {
  const candidate = (ctx as { env?: { DB?: unknown } }).env?.DB as Partial<D1Database> | undefined;
  return candidate && typeof candidate.prepare === "function" ? candidate as D1Database : undefined;
}
function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
async function schema(database: D1Database): Promise<void> {
  await database.prepare("CREATE TABLE IF NOT EXISTS marketplace_users (telegram_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS marketplace_listings (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, condition TEXT NOT NULL, photos TEXT NOT NULL, usd_price REAL NOT NULL, seller_id INTEGER NOT NULL, status TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS marketplace_listings_active ON marketplace_listings(status, id)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS marketplace_orders (id TEXT PRIMARY KEY, buyer_id INTEGER NOT NULL, listing_id TEXT NOT NULL, ltc_amount REAL NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, paid_at INTEGER, release_at INTEGER)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS marketplace_orders_release ON marketplace_orders(status, release_at)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS marketplace_escrows (order_id TEXT PRIMARY KEY, tx_id TEXT, amount REAL NOT NULL, fee REAL NOT NULL, release_status TEXT NOT NULL)").run();
}
export async function saveListing(ctx: EnvContext, listing: Omit<Listing, "id" | "status">, user: User): Promise<Listing | undefined> {
  try {
    const database = db(ctx); if (!database) return undefined; await schema(database);
    const created: Listing = { ...listing, id: id("lst"), status: "active" };
    await database.prepare("INSERT INTO marketplace_users (telegram_id, display_name) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET display_name=excluded.display_name").bind(user.telegramId, user.displayName).run();
    await database.prepare("INSERT INTO marketplace_listings (id,title,description,condition,photos,usd_price,seller_id,status) VALUES (?,?,?,?,?,?,?,?)").bind(created.id, created.title, created.description, created.condition, JSON.stringify(created.photos), created.usdPrice, created.sellerId, created.status).run();
    return created;
  } catch { return undefined; }
}
function asListing(row: Record<string, unknown>): Listing { return { id: String(row.id), title: String(row.title), description: String(row.description), condition: row.condition as Condition, photos: JSON.parse(String(row.photos)) as string[], usdPrice: Number(row.usd_price), sellerId: Number(row.seller_id), status: row.status as Listing["status"] }; }
export async function activeListings(ctx: EnvContext, search = ""): Promise<Listing[] | undefined> {
  try {
    const database = db(ctx); if (!database) return undefined; await schema(database);
    const q = search.trim();
    const statement = q ? database.prepare("SELECT * FROM marketplace_listings WHERE status=? AND (title LIKE ? OR description LIKE ?) ORDER BY id DESC LIMIT 8").bind("active", `%${q}%`, `%${q}%`) : database.prepare("SELECT * FROM marketplace_listings WHERE status=? ORDER BY id DESC LIMIT 8").bind("active");
    return (await statement.all<Record<string, unknown>>()).results.map(asListing);
  } catch { return undefined; }
}
export async function listingById(ctx: EnvContext, listingId: string): Promise<Listing | undefined> {
  try {
    const database = db(ctx); if (!database) return undefined; await schema(database);
    const row = await database.prepare("SELECT * FROM marketplace_listings WHERE id=? AND status=?").bind(listingId, "active").first<Record<string, unknown>>();
    return row ? asListing(row) : undefined;
  } catch { return undefined; }
}
