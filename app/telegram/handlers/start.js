// // app\telegram\handlers\start.js
// import { connectDB } from "@/app/lib/mongodb";
// import User from "@/app/model/User";

// export function startHandler() {
//   return async (ctx) => {
//     await connectDB();

//     let user = await User.findOne({ telegramId: ctx.from.id });
//     if (!user) {
//       user = await User.create({
//         telegramId: ctx.from.id,
//         username: ctx.from.username,
//         firstName: ctx.from.first_name,
//         lastName: ctx.from.last_name,
//         step: 1, // مرحله اول
//       });
//     } else {
//       if (!user.step || user.step < 1) {
//         user.step = 1;
//         await user.save();
//       }
//     }
//     ctx.reply(
//       "👋 خوش آمدی! بیا بریم پروفایلت رو کامل کنیم.\n\n📌 مرحله ۱ از ۵: لطفاً اسمت رو بفرست."
//     );
//   };
// }
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";

export function startHandler() {
  return async (ctx) => {
    await connectDB();

    let user = await User.findOne({ telegramId: ctx.from.id });
    // اگر کاربر وجود داره و پروفایل کامل کرده
    if (user && user.step >= 6) {
      return ctx.telegram.sendMessage(
        ctx.chat.id,
        `👋 خوش برگشتی ${user.name}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "محصولات", callback_data: "show_product" }],
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
        step: 1,
      });
    } else {
      // اگر اسم یا مرحله اولیه هنوز تکمیل نشده، فقط همین را ریست کن
      if (!user.name || user.step < 1) {
        user.step = 1;
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
