// app\telegram\handlers\callback.js
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
import { searchHandler } from "./searchHandler";
import { activeChats } from "../bot";
import { productsHandler, userProductPage } from "./products";
import Order from "@/app/model/Order";
import Product from "@/app/model/product";
import { ADMIN_PHONE } from "./start";
export function callbackHandler() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    // ⚠️ اضافه کردن بررسی چت فعال
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
      return ctx.reply(
        "❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید."
      );
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) {
      console.error(`[DEBUG] User not found for ID: ${ctx.from.id}`);
      return ctx.reply("❌ پروفایل شما پیدا نشد. لطفاً دوباره /start بزنید.");
    }

    console.log(`[DEBUG] Callback data received: ${data}`); // برای دیباگ: چک کنید در کنسول سرور ظاهر شود
    if (data === "edit_photos") {
      await ctx.answerCbQuery(); // اضافه شده برای پاسخ سریع
      return ctx.reply("کدوم عکس رو میخوای تغییر بدی؟", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📸 عکس ۱", callback_data: "photo_slot_1" }],
            [{ text: "📸 عکس ۲", callback_data: "photo_slot_2" }],
            [{ text: "📸 عکس ۳", callback_data: "photo_slot_3" }],
            [{ text: "⬅️ بازگشت", callback_data: "show_profile" }],
          ],
        },
      });
    }

    if (data === "edit_profile") {
      await ctx.answerCbQuery(); // اضافه شده
      return ctx.reply("کدوم بخش رو میخوای ویرایش کنی؟", {
        reply_markup: {
          inline_keyboard: [[{ text: "ادرس", callback_data: "address" }]],
        },
      });
    }

    if (data === "address") {
      try {
        await ctx.answerCbQuery(); // بلافاصله پاسخ به تلگرام (حل ارور 400)
        user.step = "address_province"; // حالا string است
        await user.save();
        console.log(
          `[DEBUG] Set step to address_province for user ${ctx.from.id}`
        );
        return ctx.reply("🗺 لطفاً نام استان خود را وارد کنید:");
      } catch (err) {
        console.error(`[ERROR] Failed to set address step: ${err.message}`);
        await ctx.answerCbQuery("❌ خطا در ذخیره اطلاعات"); // حتی در error، query را close کنیم
        return ctx.reply("❌ خطایی رخ داد. لطفاً دوباره امتحان کنید.");
      }
    }

    // دکمه آپلود عکس
    if (data === "upload_photos") {
      await ctx.answerCbQuery();
      return ctx.reply("📸 یکی از گزینه‌های زیر رو انتخاب کن:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📷 عکس ۱", callback_data: "photo_slot_1" }],
            [{ text: "📷 عکس ۲", callback_data: "photo_slot_2" }],
            [{ text: "📷 عکس ۳", callback_data: "photo_slot_3" }],
          ],
        },
      });
    }

    // next و like
    if (data === "next_profile") {
      const index = userSearchIndex.get(ctx.from.id) || 0;
      const results = userSearchResults.get(ctx.from.id);
      if (!results || results.length === 0)
        return ctx.reply("❌ هیچ پروفایلی برای نمایش نیست.");

      const nextIndex = (index + 1) % results.length;
      userSearchIndex.set(ctx.from.id, nextIndex);
      return searchHandler(ctx); // نمایش پروفایل بعدی
    }
    if (data === "list") {
      return ctx.reply("لطفا انتخاب کنید", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "همه محصولات", callback_data: "list_products" }],
            [{ text: "سامسونگ", callback_data: "category_samsung" }],
            [{ text: "شیائومی", callback_data: "category_xiaomi" }],
            [
              {
                text: "ایفون",
                callback_data: "category_iphone",
              },
            ],
          ],
        },
      });
    }
    if (data.startsWith("category_")) {
      const category = data.replace("category_", "");
      userProductPage.set(ctx.from.id, 0);
      return productsCategoryHandler(ctx, category);
    }

    if (data.startsWith("next_productsCategory_")) {
      const category = data.replace("next_productsCategory_", "");
      const current = userProductPage.get(ctx.from.id) || 0;
      userProductPage.set(ctx.from.id, current + 1);
      return productsCategoryHandler(ctx, category);
    }

    if (data.startsWith("prev_productsCategory_")) {
      const category = data.replace("prev_productsCategory_", "");
      const current = userProductPage.get(ctx.from.id) || 0;
      const newPage = current > 0 ? current - 1 : 0;
      userProductPage.set(ctx.from.id, newPage);
      return productsCategoryHandler(ctx, category);
    }

    // product
    if (data === "list_products") {
      userProductPage.set(ctx.from.id, 0);
      return productsHandler(ctx);
    }
    if (data === "next_products") {
      const current = userProductPage.get(ctx.from.id) || 0;
      userProductPage.set(ctx.from.id, current + 1);
      return productsHandler(ctx);
    }

    if (data === "prev_products") {
      const current = userProductPage.get(ctx.from.id) || 0;
      const newPage = current > 0 ? current - 1 : 0;
      userProductPage.set(ctx.from.id, newPage);
      return productsHandler(ctx);
    }

    // سفارش
    if (data.startsWith("order_")) {
      const productId = data.replace("order_", "");
      return ctx.reply(`✅ سفارش محصول ${productId} ثبت شد.`);
    }

    // admin

    if (user.name === ADMIN_PHONE) {
      if (data === "admin_add_product") {
        user.step = "add_product_title";
        await user.save();
        return ctx.reply("📝 نام محصول را وارد کنید:");
      }
    }

    if (data === "admin_orders") {
      return ctx.reply("📋 مدیریت سفارشات:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ منتظر تأیید", callback_data: "orders_pending" }],
            [{ text: "✅ تأیید شده", callback_data: "orders_approved" }],
          ],
        },
      });
    }

    if (data === "orders_pending") {
      await connectDB();
      const orders = await Order.find({ status: "pending" });

      if (orders.length === 0) {
        return ctx.reply("⏳ سفارشی در انتظار تأیید وجود ندارد.");
      }

      for (const order of orders) {
        const user = await User.findOne({ _id: order.userId });
        const product = await Product.findOne({ _id: order.productId });

        await ctx.replyWithPhoto(order.paymentReceipt, {
          caption: `🛒 سفارش محصول: ${product?.title}\n👤 خریدار: ${user?.name}\n📱 شماره: ${user?.phone}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ تأیید", callback_data: `approve_${order._id}` },
                { text: "❌ رد", callback_data: `reject_${order._id}` },
              ],
              [
                {
                  text: "💬 چت با خریدار",
                  callback_data: `chat_${user?.telegramId}`,
                },
              ],
            ],
          },
        });
      }
    }

    if (data.startsWith("approve_")) {
      const orderId = data.replace("approve_", "");
      await connectDB();
      const order = await Order.findById(orderId);
      if (!order) return ctx.reply("❌ سفارش پیدا نشد.");

      order.status = "approved";
      await order.save();

      await ctx.reply("✅ سفارش تایید شد.");
      await ctx.telegram.sendMessage(
        order.userId,
        "🎉 سفارش شما تایید شد! به زودی پردازش می‌شود."
      );
    }

    if (data.startsWith("reject_")) {
      const orderId = data.replace("reject_", "");
      await connectDB();
      const order = await Order.findById(orderId);
      if (!order) return ctx.reply("❌ سفارش پیدا نشد.");

      order.status = "rejected";
      await order.save();

      await ctx.reply("❌ سفارش رد شد.");
      await ctx.telegram.sendMessage(
        order.userId,
        "⛔ سفارش شما رد شد. لطفاً با پشتیبانی تماس بگیرید."
      );
    }

    if (data.startsWith("chat_")) {
      const buyerId = Number(data.replace("chat_", ""));
      activeChats.set(ctx.from.id, buyerId);
      activeChats.set(buyerId, ctx.from.id);

      await ctx.reply("💬 چت با خریدار شروع شد. پیام‌ها مستقیم ارسال می‌شوند.");
      await ctx.telegram.sendMessage(
        buyerId,
        "💬 مدیر برای گفتگو به شما وصل شد."
      );
    }

    //
  };
}
