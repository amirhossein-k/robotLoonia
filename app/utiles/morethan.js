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
