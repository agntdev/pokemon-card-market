import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { listingById } from "../marketplace.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("order:initiate", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Choose a card from Browse listings, then tap Buy now.", { reply_markup: inlineKeyboard([[inlineButton("Browse listings", "listing:browse")]]) });
});
composer.callbackQuery(/^order:initiate:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const listing = await listingById(ctx, ctx.match[1]);
  if (!listing) { await ctx.reply("That listing is no longer available. Browse the current listings to find another card."); return; }
  if (ctx.from?.id === listing.sellerId) { await ctx.reply("You can’t buy your own listing."); return; }
  await ctx.reply(`This card is $${listing.usdPrice.toFixed(2)}. LTC checkout isn’t set up yet, so no payment address has been created.`, { reply_markup: inlineKeyboard([[inlineButton("Browse listings", "listing:browse")]]) });
});

export default composer;
