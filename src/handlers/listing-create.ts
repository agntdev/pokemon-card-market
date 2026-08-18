import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { saveListing, type Condition } from "../marketplace.js";

registerMainMenuItem({ label: "➕ Create listing", data: "listing:create", order: 10 });
const composer = new Composer<Ctx>();
const conditions: Condition[] = ["Mint", "Near Mint", "Lightly Played", "Played", "Damaged"];
const back = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery("listing:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.listingSearch = false;
  ctx.session.listingDraft = { step: "title", photos: [] };
  await ctx.reply("What’s the card’s title?", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "listing:cancel")]]) });
});

composer.callbackQuery("listing:cancel", async (ctx) => { await ctx.answerCallbackQuery(); delete ctx.session.listingDraft; await ctx.editMessageText("Listing creation is cancelled.", { reply_markup: back }); });
composer.on("message:text", async (ctx, next) => {
  const draft = ctx.session.listingDraft;
  if (!draft) return next();
  const text = ctx.message.text.trim();
  if (!text || text.length > 300) { await ctx.reply("Keep it between 1 and 300 characters, then try again."); return; }
  if (draft.step === "title") { draft.title = text; draft.step = "description"; await ctx.reply("Add a short description for buyers."); return; }
  if (draft.step === "description") { draft.description = text; await ctx.reply("Choose the card’s condition.", { reply_markup: inlineKeyboard(conditions.map((condition) => [inlineButton(condition, `listing:condition:${condition}`)])) }); return; }
  if (draft.step === "price") {
    const price = Number(text.replace(/^\$/, ""));
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000 || !/^\d+(\.\d{1,2})?$/.test(text.replace(/^\$/, ""))) { await ctx.reply("Enter a USD price such as 24.50."); return; }
    if (!draft.title || !draft.description || !draft.condition || !ctx.from) { delete ctx.session.listingDraft; await ctx.reply("That listing couldn’t be saved. Start again from the menu.", { reply_markup: back }); return; }
    const listing = await saveListing(ctx, { title: draft.title, description: draft.description, condition: draft.condition, photos: draft.photos, usdPrice: price, sellerId: ctx.from.id }, { telegramId: ctx.from.id, displayName: ctx.from.first_name });
    delete ctx.session.listingDraft;
    await ctx.reply(listing ? `Your listing is live for $${listing.usdPrice.toFixed(2)}.` : "Listings aren’t set up yet. Please try again once storage is available.", { reply_markup: back });
  }
});
composer.callbackQuery(/^listing:condition:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const draft = ctx.session.listingDraft; const condition = ctx.match[1] as Condition;
  if (!draft || !conditions.includes(condition)) { await ctx.reply("Start a new listing from the menu.", { reply_markup: back }); return; }
  draft.condition = condition; draft.step = "photos";
  await ctx.editMessageText("Send up to 10 card photos. Tap Done when you’re ready to price it.", { reply_markup: inlineKeyboard([[inlineButton("Done adding photos", "listing:photos:done")], [inlineButton("Cancel", "listing:cancel")]]) });
});
composer.on("message:photo", async (ctx, next) => {
  const draft = ctx.session.listingDraft; if (!draft || draft.step !== "photos") return next();
  if (draft.photos.length >= 10) { await ctx.reply("You can add up to 10 photos. Tap Done to continue."); return; }
  draft.photos.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
  await ctx.reply(`Photo added (${draft.photos.length}/10). Send another or tap Done.`);
});
composer.callbackQuery("listing:photos:done", async (ctx) => { await ctx.answerCallbackQuery(); const draft = ctx.session.listingDraft; if (!draft || draft.step !== "photos") { await ctx.reply("Start a new listing from the menu.", { reply_markup: back }); return; } draft.step = "price"; await ctx.editMessageText("What price would you like in USD?", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "listing:cancel")]]) }); });

export default composer;
