import { AppError, Ctx } from './context';

// The seller's public page. Subscribed sellers get a verified tick, can change their photo, and collect likes from buyers.

/** A paid plan that has not run out. A plan with no end date was given by Ceeneet and counts as active. */
export const isSubscribed = (s: { plan: string; plan_until: Date | null }) => s.plan !== 'free' && (!s.plan_until || s.plan_until.getTime() > Date.now());

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_PHOTO_CHARS = 250_000;
export const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

export async function setPhoto(ctx: Ctx, seller: { id: string; plan: string; plan_until: Date | null }, photo: string | null): Promise<void> {
  if (!isSubscribed(seller)) throw new AppError('subscription_required', 403, 'Subscribe to change your photo.');
  if (photo !== null && (photo.length > MAX_PHOTO_CHARS || !PHOTO.test(photo))) throw new AppError('invalid_photo', 400, 'Choose a smaller JPG, PNG or WebP photo.');
  await ctx.db.query(`update sellers set photo = $2 where id = $1`, [seller.id, photo]);
}

export async function likeCount(ctx: Ctx, sellerId: string): Promise<number> {
  const [r] = await ctx.db.query<{ n: string }>(`select count(*)::text as n from seller_likes where seller_id = $1`, [sellerId]);
  return Number(r?.n ?? 0);
}

type PublicRow = { id: string; slug: string; shop_name: string; category: string; city: string; created_at: Date; plan: string; plan_until: Date | null; photo: string | null };

export async function publicProfile(ctx: Ctx, slug: string, visitor?: string) {
  const [s] = await ctx.db.query<PublicRow>(`select id, slug, shop_name, category, city, created_at, plan, plan_until, photo from sellers where slug = $1`, [slug]);
  if (!s) throw new AppError('not_found', 404);
  const subscribed = isSubscribed(s);
  const likes = subscribed ? await likeCount(ctx, s.id) : 0;
  const liked = subscribed && visitor && VISITOR.test(visitor) ? !!(await ctx.db.query(`select 1 from seller_likes where seller_id = $1 and visitor = $2`, [s.id, visitor]))[0] : false;
  return {
    slug: s.slug,
    name: s.shop_name,
    category: s.category,
    city: s.city,
    since: s.created_at.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    verified: subscribed,
    photo: subscribed ? s.photo : null,
    likesEnabled: subscribed,
    likes,
    liked,
  };
}

export async function setLike(ctx: Ctx, slug: string, visitor: string, liked: boolean): Promise<{ likes: number; liked: boolean }> {
  if (!VISITOR.test(visitor)) throw new AppError('bad_request', 400, 'Missing visitor.');
  const [s] = await ctx.db.query<PublicRow>(`select id, plan, plan_until from sellers where slug = $1`, [slug]);
  if (!s || !isSubscribed(s)) throw new AppError('not_found', 404);
  if (liked) await ctx.db.query(`insert into seller_likes (seller_id, visitor) values ($1, $2) on conflict do nothing`, [s.id, visitor]);
  else await ctx.db.query(`delete from seller_likes where seller_id = $1 and visitor = $2`, [s.id, visitor]);
  return { likes: await likeCount(ctx, s.id), liked };
}
