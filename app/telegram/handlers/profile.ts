// app\telegram\handlers\profile.ts
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
import { getProvinceKeyboard, provinces } from '@/app/lib/provinces'
import { cities, getCityKeyboard } from "@/app/lib/cities";
import { InputMediaPhoto } from "typegram";
import { ADMIN_PHONE } from "./start";

export function profileHandler() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (ctx: any) => {
        await connectDB()

        let user = await User.findOne({ telegramId: ctx.from.id });

        if (!user) {
            user = await User.create({
                telegramId: ctx.from.id,
                profileSet: "1", // شروع پروفایل
            });
        } else {
            // اگر step نامعتبر بود، آن را ریست کن (اجتناب از ریست کردن پروفایل کامل شده)
            if (!user.profileSet || user.profileSet < "1") {
                user.profileSet = "1";
                await user.save();
            }
        }
        // اگر پروفایل کامل است، ثبت نام را اجرا نکن
        if (user.profileSet >= "6") return;
        switch (user.profileSet) {
            case "1":
                if (ctx.message?.text) {
                    user.name = ctx.message.text
                    user.profileSet = "6"
                    await user.save()
                    if (ctx.message.text === ADMIN_PHONE) {
                        await ctx.reply("📋 پنل مدیریت:", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "➕ افزودن محصول", callback_data: "admin_add_product" }],
                                    [{ text: "📦 مدیریت محصولات", callback_data: "admin_manage_products" }],
                                    [{ text: "📦 لیست محصولات", callback_data: "list" }],
                                    [{ text: "🛒 لیست سفارشات", callback_data: "admin_orders" }],
                                    [{ text: "👥 کاربران سفارش‌دهنده", callback_data: "admin_order_users" }],

                                ],
                            },
                        });
                    } else {


                        return ctx.reply("مرسی که ما را انتخاب کردی برای دیدن محصولات روی دکمه مربوط به ان کلیک کن", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }],

                                ]
                            }
                        })
                    }

                }
                break



            default:
                // 🔥 اینجا به جای پیام خطا، کاربر رو برگردون به مرحله اول
                user.profileSet = "1";
                await user.save();
                return ctx.reply("📌 مرحله ۱ از ۵: لطفاً اسمت رو وارد کن:");
        }

    }

}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendProfile(ctx: any, targetId?: number) {
    await connectDB();
    const userId = targetId || ctx.from.id;
    const user = await User.findOne({ telegramId: userId });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    const urls = Object.values(user.photos).filter(Boolean) as string[];
    if (urls.length > 0) {
        const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
            type: "photo",
            media: url,
            caption: idx === 0 ? "📸 عکس‌های شما" : undefined,
        }));
        await ctx.replyWithMediaGroup(media);
    }
    const genderText = user.gender === "male" ? "مرد" : user.gender === "female" ? "زن" : "-";

    let profileText = `
👤 پروفایل شما:
📝 نام: ${user.name || "-"}
🚻 جنسیت: ${genderText || "-"}
🎂 سن: ${user.age || "-"}
📍 استان: ${provinces[user.province] || "-"}
🏙 شهر:  ${cities[user.province][user.city] || "-"}
❤️ لایک‌های باقی‌مانده: ${user.isPremium ? "نامحدود" : user.likesRemaining}
`;

    profileText += `📝 درباره من\n${user.bio || "مشخص نشده"}\n\n`;
    profileText += `🔎 دنبال چی هستم\n${user.lookingFor || "مشخص نشده"}\n\n`;
    if (user.interests?.length) profileText += `🍿 علایق و سرگرمی‌ها\n${user.interests.join("، ")}\n\n`;
    else profileText += `🍿 علایق و سرگرمی‌ها\nمشخص نشده\n\n`;

    const buttons = [
        [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
        [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
        [{ text: "🔍 جستجو بر اساس استان", callback_data: "search_by_province" }],
        [{ text: "🎲 جستجوی تصادفی", callback_data: "search_random" }],
        [{ text: "💌 کسانی که مرا لایک کردند", callback_data: "liked_by_me" }],
    ];

    if (!user.isPremium) buttons.push([{ text: "⭐️ عضویت ویژه", callback_data: "buy_premium" }]);

    await ctx.reply(profileText, { reply_markup: { inline_keyboard: buttons } });
}