import { connectDB } from "@/app/lib/mongodb";
import product from "@/app/model/product";

export const userProductPage = new Map();
// برای نگه‌داشتن آیدی پیام‌های محصولات
export const userProductMessages = new Map();

export async function productsHandler(ctx) {
  await connectDB();

  const product = await product.find({});

  if (!products || products.length === 0) {
    return ctx.reply("❌ محصولی موجود نیست.");
  }

  //صفحه فعلی
  const page = userProductPage.get(ctx.from.id) || 0;
  const start = page * 4;
  const end = start + 4;
  const items = product.slice(start, end);

  // 🗑 حذف پیام‌های قبلی
  const oldMessages = userProductMessages.get(ctx.from.id) || [];
  for (const msgId of oldMessages) {
    try {
      await ctx.deleteMessage(msgId);
    } catch (e) {
      // پیام شاید پاک نشده باشه → مشکلی نیست
    }
  }
  const newMessages = [];

  for (const product of items) {
    const sent = await ctx.replyWithPhoto(product.photoUrl, {
      caption: `🛍 ${product.title}\n\n${product.description}\n💵 قیمت: ${product.price} تومان\n📏 اندازه: ${product.size}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 ثبت سفارش", callback_data: `order_${product._id}` }],
        ],
      },
    });
    newMessages.push(sent.message_id);
  }

  // دکمه بعدی فقط وقتی محصولات بیشتری هست
  // ساخت دکمه‌های ناوبری
  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: "⏮ قبلی", callback_data: "prev_products" });
  }
  if (end < products.length) {
    navButtons.push({ text: "⏭ بعدی", callback_data: "next_products" });
  }

  if (navButtons.length > 0) {
    const sent = await ctx.replyWithPhoto(product.photoUrl, {
      caption: `🛍 ${product.title}\n\n${product.description}\n💵 قیمت: ${product.price} تومان\n📏 اندازه: ${product.size}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 ثبت سفارش", callback_data: `order_${product._id}` }],
        ],
      },
    });
    newMessages.push(sent.message_id);
  }
  // ذخیره پیام‌های جدید
  userProductMessages.set(ctx.from.id, newMessages);
}
