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
      // return ctx.reply(`👋 خوش برگشتی ${user.name}!\n\nپروفایلت اینجاست:`, {
      //   reply_markup: {
      //     keyboard: [
      //       ["پروفایل من", "🖼 ویرایش عکس‌ها"],
      //       ["✏️ ویرایش پروفایل", "❓ راهنما"],
      //       // [{ text: "📜 شرایط استفاده", callback_data: "terms" }],
      //       // [{ text: "📸 آپلود عکس", callback_data: "upload_photos" }],
      //     ],
      //     resize_keyboard: true, // سایز رو متناسب می‌کنه
      //     one_time_keyboard: false, // همیشه بمونه
      //   },
      // });
      return ctx.telegram.sendMessage(
        ctx.chat.id,
        `👋 خوش برگشتی ${user.name}!\n\nپروفایلت اینجاست:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 پروفایل من", callback_data: "show_profile" }],
              [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
              [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
              [
                {
                  text: "🔍 جستجو بر اساس استان",
                  callback_data: "search_by_province",
                },
              ],
              [{ text: "🎲 جستجوی تصادفی", callback_data: "search_random" }],
            ],
          },
        }
      );
    }
    // اگر کاربر جدید بود یا پروفایل ناقص داشت → مرحله ۱

    if (!user) {
      user = await User.create({
        telegramId: ctx.from.id,
        // username: ctx.from.username,
        // firstName: ctx.from.first_name,
        // lastName: ctx.from.last_name,
        step: 1,
      });
    } else {
      user.step = 1;
      await user.save();
    }

    // پیام خوش‌آمد + درخواست اسم (در caption)
    await ctx.reply(
      "👋 خوش آمدی! بیا پروفایلت رو بسازیم.\n\n📌 مرحله ۱ از ۵: لطفاً اسمت رو ارسال کن."
    );
  };
}
