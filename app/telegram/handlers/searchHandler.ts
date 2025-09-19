// app/telegram/handlers/searchHandler.ts
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
import { InputMediaPhoto } from "typegram";

export const userSearchIndex = new Map<number, number>(); // نگهداری شاخص پروفایل در جستجو برای هر کاربر
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userSearchResults = new Map<number, any[]>(); // نگهداری نتایج جستجو برای هر کاربر

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function searchHandler(ctx: any) {
    await connectDB();

    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user || user.step < 6) return ctx.reply("❌ لطفاً ابتدا پروفایل خود را کامل کنید.");

    // اگر نتایج قبلی موجود است، ادامه بده
    let results = userSearchResults.get(ctx.from.id);
    let index = userSearchIndex.get(ctx.from.id) || 0;

    if (!results) {
        // پیدا کردن کاربران دیگر بر اساس شهر و مرتب‌سازی بر اساس سن
        results = await User.find({
            telegramId: { $ne: user.telegramId }, // کاربر خودشو حذف کن
            city: user.city,
            step: { $gte: 6 },// فقط پروفایل کامل شده
            gender: user.gender === "female" ? "male" : "female" // جنسیت مخالف

        }).sort({ age: 1 }); // سن صعودی

        if (!results.length) return ctx.reply("❌ هیچ پروفایلی پیدا نشد.");

        userSearchResults.set(ctx.from.id, results);
        index = 0;
        userSearchIndex.set(ctx.from.id, index);
    }

    const targetUser = results[index];

    // جمع‌آوری عکس‌ها
    const urls = Object.values(targetUser.photos).filter(Boolean) as string[];
    if (urls.length > 0) {
        const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
            type: "photo",
            media: url,
            caption: idx === 0 ? `👤 ${targetUser.name}, ${targetUser.age} سال` : undefined,
        }));

        await ctx.replyWithMediaGroup(media);
    } else {
        await ctx.reply(`👤 ${targetUser.name}, ${targetUser.age} سال\n📍 ${targetUser.city}`);
    }
    // else {
    //     await ctx.reply(`👤 ${targetUser.name}, ${targetUser.age} سال\n📍 ${targetUser.city}`);
    // }


    // متن پروفایل کامل
    const profileText = `
👤 نام: ${targetUser.name || "-"}
🚻 جنسیت:  ${targetUser.gender === "female" ? "زن" : "مرد"}
🎂 سن: ${targetUser.age || "-"}
📍 استان: ${targetUser.province || "-"}
🏙 شهر: ${targetUser.city || "-"}
📝 بیو: ${targetUser.bio || "-"}
  `;

    // دکمه‌های بعدی و لایک
    await ctx.reply(profileText, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "❤️ لایک", callback_data: `like_${targetUser.telegramId}` },
                    { text: "➡️ بعدی", callback_data: "next_profile" }
                ]
            ]
        }
    });
}
