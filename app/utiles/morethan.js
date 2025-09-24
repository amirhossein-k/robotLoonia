// app\utiles\morethan.js
import User from "@/app/model/User";
import { connectDB } from "../lib/mongodb";

// تابع برای پیدا کردن کاربر بر اساس نام
export async function findTelegramIdByName(name) {
  await connectDB(); // ⭐ حتما اضافه کن

  const user = await User.findOne({ name: name });
  return user ? user.telegramId : null;
}

// 🕒 زمان به وقت تهران
// const createdAtTehran = new Intl.DateTimeFormat("fa-IR", {
//   dateStyle: "full",
//   timeStyle: "short",
//   timeZone: "Asia/Tehran",
// }).format(order.createdAt);

// حذف پیام رسید از چت ادمین
// try {
//     if (ctx.chat && order.adminMessageId) {
//         await ctx.telegram.deleteMessage(ctx.chat.id, order.adminMessageId);
//     }

// } catch (e) {
//     console.error("❌ خطا در حذف پیام رسید:", e);
// }

// پاک کردن همه پیام‌های کاربر
// const orders = await Order.find({ userId: order.userId });
// for (const o of orders) {
//     if (o.adminMessageId) {
//         try {
//             await ctx.telegram.deleteMessage(ctx.chat!.id, o.adminMessageId);
//             o.adminMessageId = undefined;
//             await o.save();
//         } catch (err) {
//             console.error("❌ خطا در حذف پیام:", err);
//         }
//     }
// }
