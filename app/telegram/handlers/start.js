import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
export const ADMIN_PHONE = "09391470427";

export function startHandler() {
  return async (ctx) => {
    await connectDB();

    let user = await User.findOne({ telegramId: ctx.from.id });
    // اگر کاربر وجود داره و پروفایل کامل کرده
    if (user && user.profileSet >= "6") {
      if (user.name === ADMIN_PHONE) {
        // فقط پنل مدیریت برای ادمین
        return await ctx.reply("📋 پنل مدیریت:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ افزودن محصول", callback_data: "admin_add_product" }],
              [{ text: "📦 لیست محصولات", callback_data: "list" }],
              [{ text: "🛒 لیست سفارشات", callback_data: "admin_orders" }],
            ],
          },
        });
      }
      return ctx.telegram.sendMessage(
        ctx.chat.id,
        `👋 خوش برگشتی ${user.name}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "محصولات", callback_data: "list" }],
              [{ text: "پیگیری سفارش", callback_data: "peigiri" }],
              [{ text: "ادرس", callback_data: "address" }],
              [
                {
                  text: "دسته بندی",
                  callback_data: "category",
                },
              ],
            ],
          },
        }
      );
    }
    // اگر کاربر جدید بود یا پروفایل ناقص داشت → مرحله ۱
    // اگر کاربر جدید است
    if (!user) {
      user = await User.create({
        telegramId: ctx.from.id,
        profileSet: "1",
      });
    } else {
      // اگر اسم یا مرحله اولیه هنوز تکمیل نشده، فقط همین را ریست کن
      if (!user.name || user.profileSet < "1") {
        user.profileSet = "1";
        await user.save();
      } else {
        // پروفایل ناقص ولی اسم دارد → مرحله بعد یا پیام منو بده
        return ctx.telegram.sendMessage(
          ctx.chat.id,
          `👋 خوش برگشتی ${user.name}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "محصولات", callback_data: "show_product" }],
                [{ text: "پیگیری سفارش", callback_data: "peigiri" }],
                [{ text: "ادرس", callback_data: "address" }],
                [{ text: "دسته بندی", callback_data: "category" }],
              ],
            },
          }
        );
      }
    }
    // پیام درخواست اسم فقط وقتی اسم وجود ندارد
    if (!user.name) {
      await ctx.reply("👋 خوش آمدی!\n\n📌 لطفاً اسمت را ارسال کن.");
    }
  };
}
