import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { activeListings } from "../marketplace.js";

registerMainMenuItem({ label: "Browse listings", data: "listing:browse", order: 20 });
const composer = new Composer<Ctx>();

async function showListings(ctx: Ctx, search = ""): Promise<void> {
  const listings = await activeListings(ctx, search);
  if (!listings) { await ctx.reply("Listings aren’t set up yet. Please try again once storage is available."); return; }
  if (listings.length === 0) { await ctx.reply(search ? "No cards match that search. Try a different title or description." : "No listings yet — tap ➕ Create listing to add one.", { reply_markup: inlineKeyboard([[inlineButton("Search listings", "listing:search")]]) }); return; }
  for (const listing of listings) await ctx.reply(`${listing.title}\n${listing.condition} · $${listing.usdPrice.toFixed(2)}\n${listing.description}`, { reply_markup: inlineKeyboard([[inlineButton("Buy now", `order:initiate:${listing.id}`)]]) });
  await ctx.reply("Looking for something else?", { reply_markup: inlineKeyboard([[inlineButton("Search listings", "listing:search")]]) });
}

composer.callbackQuery("listing:browse", async (ctx) => {
  await ctx.answerCallbackQuery();
  delete ctx.session.listingDraft;
  await showListings(ctx);
});
composer.callbackQuery("listing:search", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.listingSearch = true; await ctx.reply("Type a card title or a word from its description."); });
composer.on("message:text", async (ctx, next) => {
  if (!ctx.session.listingSearch) return next();
  ctx.session.listingSearch = false;
  await showListings(ctx, ctx.message.text);
});

export default composer;
