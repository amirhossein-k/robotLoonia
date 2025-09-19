// app\telegram\handlers\profile.ts
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
import { getProvinceKeyboard, provinces } from '@/app/lib/provinces'
import { cities, getCityKeyboard } from "@/app/lib/cities";
import { InputMediaPhoto } from "typegram";

export function profileHandler() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (ctx: any) => {
        await connectDB()

        let user = await User.findOne({ telegramId: ctx.from.id });

        if (!user) {
            user = await User.create({
                telegramId: ctx.from.id,
                step: 1, // شروع پروفایل
            });
        } else {
            // اگر step نامعتبر بود، آن را ریست کن (اجتناب از ریست کردن پروفایل کامل شده)
            if (!user.step || user.step < 1) {
                user.step = 1;
                await user.save();
            }
        }
        // اگر پروفایل کامل است، ثبت نام را اجرا نکن
        if (user.step >= 6) return;
        switch (user.step) {
            case 1:
                if (ctx.message?.text) {
                    user.name = ctx.message.text
                    user.step = 2
                    await user.save()

                    return ctx.reply("📌 مرحله ۲ از ۵: جنسیتت رو انتخاب کن:", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "👨 مرد", callback_data: "gender_male" }],
                                [{ text: "👩 زن", callback_data: "gender_female" }],
                            ]
                        }
                    })
                }
                break
            // ♂♀ مرحله ۲: گرفتن جنسیت (callback)
            case 2:
                if (ctx.callbackQuery?.data?.startsWith("gender_")) {
                    const gender = ctx.callbackQuery.data === "gender_male" ? "male" : "female";

                    user.gender = gender;
                    user.step = 3;
                    await user.save();

                    await ctx.answerCbQuery();
                    return ctx.reply("📌 مرحله ۳ از ۵: سنت رو وارد کن (عدد):");
                }
                break;
            case 3://سن
                if (ctx.message?.text && !isNaN(Number(ctx.message.text))) {
                    user.age = Number(ctx.message.text)
                    user.step = 4
                    await user.save()

                    return ctx.reply("📌 مرحله ۴ از ۵: استانت رو انتخاب کن:", getProvinceKeyboard(false));
                } else {
                    return ctx.reply("❌ لطفاً یک عدد معتبر بفرست.");
                }
            case 4: //استان
                if (ctx.callbackQuery?.data?.startsWith("profile_province_")) {
                    const provinceKey = ctx.callbackQuery.data.replace("profile_province_", "");
                    user.province = provinceKey; // کلید انگلیسی ذخیره شود


                    user.step = 5;
                    await user.save();

                    await ctx.answerCbQuery();
                    return ctx.reply(
                        "📌 مرحله ۵ از ۵: شهرت رو انتخاب کن:",
                        getCityKeyboard(provinceKey)
                    );
                }
                break;
            case 5:      // 📍 مرحله ۵: انتخاب شهر

                if (ctx.callbackQuery?.data?.startsWith("profile_city_")) {
                    const parts = ctx.callbackQuery.data.split("_");
                    const provinceCode = parts.slice(2, parts.length - 1).join("_");
                    const cityCode = parts[parts.length - 1];

                    user.province = provinceCode;
                    user.city = cityCode;

                    user.step = 6; // پروفایل تکمیل شد
                    const genderText = user.gender === "male" ? "مرد" : user.gender === "female" ? "زن" : "-";

                    await user.save();

                    await ctx.answerCbQuery("پروفایل شما کامل شد!");

                    return ctx.telegram.sendMessage(
                        ctx.chat.id,
                        `✅ پروفایلت ساخته شد!\n\n👤 نام: ${user.name}\n👫 جنسیت: ${genderText
                        }\n🎂 سن: ${user.age}\n📍 استان: ${provinces[user.province]}\n🏙 شهر: ${cities[user.province][user.city]
                        }`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "👤 پروفایل من", callback_data: "show_profile" }],
                                [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
                                [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
                            ],

                        },
                    }
                    );
                }
                break;
            default:
                // 🔥 اینجا به جای پیام خطا، کاربر رو برگردون به مرحله اول
                user.step = 1;
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