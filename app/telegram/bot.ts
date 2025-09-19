// app\telegram\bot.ts
import { Telegraf } from "telegraf";
import { profileHandler, sendProfile } from "./handlers/profile";
import { callbackHandler } from "./handlers/callback";
import { photoUploadHandler, setPhotoSlotHandler } from "./handlers/photoHandler";
import { startHandler } from "./handlers/start";
import { connectDB } from "../lib/mongodb";
import User from "../model/User";
import { InputMedia, InputMediaPhoto, CallbackQuery } from "typegram";
import { searchHandler, userSearchIndex, userSearchResults } from "./handlers/searchHandler";

import Message from "@/app/model/Message";
import Chat from "../model/Chat";
import { getProvinceKeyboard, provinces } from "../lib/provinces";
import { cities, getCityKeyboard } from "../lib/cities";
const activeChats = new Map<number, number>();
const editState = new Map<number, "about" | "searching" | "interests" | "name" | "age">();


const bot = new Telegraf(process.env.BOT_TOKEN!);
// ---- استارت و ثبت پروفایل ----
bot.start(startHandler()); // اینجا هندلر استارت جدید
// پیام متنی (اسم، سن و ...)
// bot.on("text", profileHandler());



// ---- Callback ها برای مراحل ثبت پروفایل ----
bot.action(/^(gender_|profile_province_|profile_city_)/, callbackHandler());
bot.action(["edit_photos", "edit_profile", "terms", "upload_photos"], callbackHandler());
bot.action(["photo_slot_1", "photo_slot_2", "photo_slot_3", "back_to_photo_menu"], setPhotoSlotHandler());
// ---- آپلود عکس ----
// bot.on("photo", photoUploadHandler());
// ---- نمایش پروفایل شخصی ----
bot.action("show_profile", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    // نمایش آلبوم عکس‌ها
    // اگر کاربر عکس دارد
    const urls = Object.values(user.photos).filter(Boolean) as string[];

    // const urls = Object.values(user.photos).filter((url) => !!url) as string[];

    if (urls.length > 0) {
        const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
            type: "photo",
            media: url,
            caption: idx === 0 ? "📸 عکس‌های شما" : undefined,
        }));

        await ctx.replyWithMediaGroup(media);
    }


    // متن پروفایل
    let profileText = `
👤 پروفایل شما:

📝 نام: ${user.name || "-"}
🚻 جنسیت: ${user.gender || "-"}
🎂 سن: ${user.age || "-"}
📍 استان: ${provinces[user.province] || "-"}
🏙 شهر:  ${cities[user.province][user.city] || "-"}
❤️ لایک‌های باقی‌مانده: ${user.isPremium ? "نامحدود" : user.likesRemaining}

`;
    profileText += `📝 درباره من\n${user.bio || "مشخص نشده"}\n\n`;
    profileText += `🔎 دنبال چی هستم\n${user.lookingFor || "مشخص نشده"}\n\n`;
    if (user.interests && user.interests.length > 0) {
        profileText += `🍿 علایق و سرگرمی‌ها\n${user.interests.join("، ")}\n\n`;
    } else {
        profileText += `🍿 علایق و سرگرمی‌ها\nمشخص نشده\n\n`;
    }



    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buttons: any[] = [
        [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
        [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
        // [{ text: "🔍 جستجو", callback_data: "search_profiles" }],
        [{ text: "🔍 جستجو بر اساس استان", callback_data: "search_by_province" }],
        [{ text: "🎲 جستجوی تصادفی", callback_data: "search_random" }],
        [{ text: "💌 کسانی که مرا لایک کردند", callback_data: "liked_by_me" }],
    ];

    if (!user.isPremium) {
        buttons.push([{ text: "⭐️ عضویت ویژه", callback_data: "buy_premium" }]);
    }



    return ctx.reply(profileText, { reply_markup: { inline_keyboard: buttons } });

});
// ---- جستجو ----
bot.action("search_profiles", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await searchHandler(ctx);
});
// 4. **هندل خرید عضویت ویژه (buy_premium)**  
// وقتی کاربر دکمه "⭐️ عضویت ویژه" رو بزنه:  
// - پیام قیمت بیاد.  
// - دکمه پرداخت (می‌تونی درگاه پرداخت ایرانی وصل کنی).  
bot.action("search_by_province", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }

    await ctx.reply(
        "📍 لطفاً استان مورد نظر خود را انتخاب کنید:",
        getProvinceKeyboard(true)
    );
});
bot.action(/search_province_.+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    // گرفتن نام استان از callback_data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // گرفتن نام استان از callback_data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provinceKey = (ctx.callbackQuery as any).data.replace("search_province_", "");
    const provinceLabel = provinces[provinceKey] || provinceKey;
    await ctx.answerCbQuery();

    // اول شهرها رو نشون بده
    await ctx.reply(
        `🏙 شهر مورد نظر در استان "${provinceLabel}" را انتخاب کن:`,
        getCityKeyboard(provinceKey, true)
    );

    // بعد نتایج رو آماده کن
    // const results = await User.find({
    //     province: provinceKey,
    //     telegramId: { $ne: user.telegramId },
    //     step: { $gte: 6 },
    // });

    // if (!results.length) {
    //     return ctx.reply(`❌ هیچ پروفایلی در استان "${provinceLabel}" یافت نشد.`);
    // }

    // // ذخیره نتایج برای نمایش مرحله‌ای
    // userSearchResults.set(user.telegramId, results);
    // userSearchIndex.set(user.telegramId, 0);

    // await ctx.reply(`✅ ${results.length} پروفایل در استان "${provinceLabel}" پیدا شد.`);
    // await searchHandler(ctx); // نمایش اولین پروفایل
});
bot.action(/search_city_.+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (ctx.callbackQuery as any).data.split("_");
    const provinceKey = parts[2]; // مثلا tehran
    const cityCode = parts[3];    // مثلا varamin
    const cityLabel = cities[provinceKey]?.[cityCode] || cityCode;

    await ctx.answerCbQuery("✅ شهر انتخاب شد!");

    // کاربرهای همان شهر
    const results = await User.find({
        province: provinceKey,
        city: cityCode,
        gender: user.gender === "female" ? "male" : "female",

        telegramId: { $ne: user.telegramId },
        step: { $gte: 6 },
    });


    if (!results.length) {
        return ctx.reply(`❌ هیچ پروفایلی در شهر "${cityCode}" پیدا نشد.`);
    }

    userSearchResults.set(user.telegramId, results);
    userSearchIndex.set(user.telegramId, 0);

    await ctx.reply(`✅ ${results.length} پروفایل در شهر "${cityLabel}" پیدا شد.`);
    await searchHandler(ctx); // نمایش اولین پروفایل
});


bot.action("search_random", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    // فقط کاربران با جنسیت مخالف و پروفایل کامل
    const allUsers = await User.find({
        telegramId: { $ne: user.telegramId },
        step: { $gte: 6 },
        gender: user.gender === "female" ? "male" : "female",
    });
    if (!allUsers.length) return ctx.reply("❌ هیچ پروفایلی برای نمایش نیست.");

    // انتخاب تصادفی
    const shuffled = allUsers.sort(() => 0.5 - Math.random());
    userSearchResults.set(user.telegramId, shuffled);
    userSearchIndex.set(user.telegramId, 0);

    await searchHandler(ctx); // نمایش اولین پروفایل
});


bot.action("buy_premium", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await ctx.reply("⭐️ عضویت ویژه\n\n✅ قیمت: 10,000 تومان\nبا خرید عضویت ویژه می‌توانید لایک نامحدود داشته باشید.", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "💳 پرداخت", url: "https://your-payment-gateway.com/pay?amount=10000" }]
            ]
        }
    });
});


// دکمه بعدی پروفایل در جستجو
// ---- پروفایل بعدی در جستجو ----
bot.action("next_profile", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    const results = userSearchResults.get(user.telegramId) || [];
    if (!results.length) return ctx.reply("❌ هیچ پروفایلی برای نمایش نیست.");

    let index = userSearchIndex.get(user.telegramId) || 0;
    index = (index + 1) % results.length;
    userSearchIndex.set(user.telegramId, index);
    await searchHandler(ctx);
});;

// ---- لایک کاربر ----
bot.action(/like_\d+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();

    // داخل handler دکمه
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (ctx.callbackQuery as any)?.data;
    if (!data) return ctx.reply("❌ خطا: داده نامعتبر");

    // حالا می‌توانیم از data استفاده کنیم
    const likedId = Number(data.replace("like_", ""));
    if (isNaN(likedId)) return ctx.reply("❌ خطا: کاربر نامعتبر");

    const user = await User.findOne({ telegramId: ctx.from.id });
    const likedUser = await User.findOne({ telegramId: likedId });
    if (!user || !likedUser) return ctx.reply("❌ کاربر پیدا نشد.");


    if (!user.isPremium) {
        if (user.likesRemaining <= 0) {
            return ctx.reply("❌ سهمیه لایک شما تمام شد.\n\nبرای لایک نامحدود باید عضویت ویژه تهیه کنید.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⭐️ عضویت ویژه", callback_data: "buy_premium" }]
                    ]
                }
            });
        }
        user.likesRemaining -= 1;
        await user.save();

        await ctx.reply(`❤️ لایک شما ثبت شد! \nتعداد لایک باقی‌مانده: ${user.likesRemaining}`);
    }
    // ثبت لایک
    if (!user.likes.includes(likedId)) {
        user.likes.push(likedId);
        await user.save();
    }

    // ثبت در likedBy کاربر مقابل و اطلاع
    if (!likedUser.likedBy.includes(user.telegramId)) {
        likedUser.likedBy.push(user.telegramId); // اضافه کردن به درخواست‌های در انتظار
        await likedUser.save();

        // اطلاع به کاربر B
        await ctx.telegram.sendMessage(likedUser.telegramId,
            `❤️ کاربر ${user.name} شما را لایک کرد!`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "مشاهده پروفایل", callback_data: `show_profile_${user.telegramId}` }],
                        [
                            { text: "قبول درخواست", callback_data: `accept_request_${user.telegramId}` },
                            { text: "رد کردن", callback_data: `reject_request_${user.telegramId}` }
                        ]
                    ]
                }
            });
    }
    // بررسی Match
    if (likedUser.likes.includes(user.telegramId) && !user.matches.includes(likedId)) {
        user.matches.push(likedId);
        likedUser.matches.push(user.telegramId);
        await user.save();
        await likedUser.save();

        await ctx.telegram.sendMessage(user.telegramId,
            `🎉 شما با ${likedUser.name} Match شدید!`);
        await ctx.telegram.sendMessage(likedUser.telegramId,
            `🎉 شما با ${user.name} Match شدید!`);
    } else {
        await ctx.reply("✅ لایک ثبت شد!");
    }
});
// ---- مشاهده کسانی که شما را لایک کردند ----
bot.action("liked_by_me", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    if (!user.likedBy.length) return ctx.reply("❌ کسی شما را لایک نکرده");

    // ساخت دکمه‌ها برای هر کاربر
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyboard = [];
    for (const id of user.likedBy) {
        const u = await User.findOne({ telegramId: id });
        if (u) {
            keyboard.push([{ text: `👤 ${u.name}`, callback_data: `show_profile_${u.telegramId}` }]);
        }
    }

    await ctx.reply("💌 کسانی که شما را لایک کردند:", {
        reply_markup: { inline_keyboard: keyboard }
    });
});
// ---- مشاهده پروفایل کاربر از دکمه ----
bot.action(/show_profile_\d+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetId = Number((ctx.callbackQuery as any)?.data.replace("show_profile_", ""));
    const targetUser = await User.findOne({ telegramId: targetId });
    const currentUser = await User.findOne({ telegramId: ctx.from.id });

    if (!targetUser || !currentUser) return ctx.reply("❌ پروفایل پیدا نشد");

    const profileText = `
👤 نام: ${targetUser.name}
🚻 جنسیت: ${targetUser.gender}
🎂 سن: ${targetUser.age}
📍 استان: ${targetUser.province}
🏙 شهر: ${targetUser.city}
📝 بیو: ${targetUser.bio || "-"}
  `;

    // نمایش عکس اگر موجود است
    const urls = Object.values(targetUser.photos).filter(Boolean) as string[];
    if (urls.length > 0) {
        const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
            type: "photo",
            media: url,
            caption: idx === 0 ? profileText : undefined,
        }));
        await ctx.replyWithMediaGroup(media);
    } else {
        await ctx.reply(profileText);
    }

    // ساخت دکمه‌ها
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyboard: any[] = [];
    // اگه این کاربر جزو کسانی بود که منو لایک کردن → دکمه شروع چت
    if (currentUser.likedBy.includes(targetId)) {
        keyboard.push([{ text: "💬 قبول درخواست چت", callback_data: `start_chat_${targetId}` }]);
    }

    await ctx.reply("👇 گزینه‌ها:", {
        reply_markup: { inline_keyboard: keyboard }
    });

});
// ---- در لایک ها شروع چت از طریق "قبول درخواست چت" ----
bot.action(/start_chat_\d+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetId = Number((ctx.callbackQuery as any)?.data.replace("start_chat_", ""));
    const user = await User.findOne({ telegramId: ctx.from.id });
    const otherUser = await User.findOne({ telegramId: targetId });
    if (!user || !otherUser) return ctx.reply("❌ کاربر پیدا نشد.");

    // بررسی اینکه کسی در حال چت نباشه
    if (activeChats.get(user.telegramId) || activeChats.get(otherUser.telegramId)) {
        return ctx.reply("❌ یکی از شما در حال چت فعال است. لطفاً بعداً امتحان کنید.");
    }

    // ایجاد رکورد چت جدید
    const newChat = await Chat.create({
        users: [user.telegramId, otherUser.telegramId],
        startedAt: new Date(),
        messages: [],
    });

    // ثبت چت فعال
    activeChats.set(user.telegramId, otherUser.telegramId);
    activeChats.set(otherUser.telegramId, user.telegramId);

    const keyboard = {
        reply_markup: {
            inline_keyboard: [[{ text: "❌ قطع ارتباط", callback_data: "end_chat" }]]
        }
    };

    await ctx.reply(`✅ شما با ${otherUser.name} وارد چت شدید.`, keyboard);
    await ctx.telegram.sendMessage(otherUser.telegramId, `✅ کاربر ${user.name} درخواست چت را قبول کرد.`, keyboard);
});



// هنگام قبول درخواست (شروع چت)
bot.action(/accept_request_\d+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromId = Number((ctx.callbackQuery as any)?.data.replace("accept_request_", ""));
    const user = await User.findOne({ telegramId: ctx.from.id });
    const otherUser = await User.findOne({ telegramId: fromId });
    if (!user || !otherUser) return ctx.reply("❌ کاربر پیدا نشد.");

    // Match کامل
    if (!user.matches.includes(fromId)) user.matches.push(fromId);
    if (!otherUser.matches.includes(user.telegramId)) otherUser.matches.push(user.telegramId);

    // حذف از pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user.pendingRequests = user.pendingRequests.filter((id: any) => id !== fromId);

    await user.save();
    await otherUser.save();

    // ایجاد رکورد چت جدید
    const newChat = await Chat.create({
        users: [user.telegramId, fromId],
        startedAt: new Date(),
        messages: [],
    });


    // ثبت چت فعال
    activeChats.set(user.telegramId, fromId);
    activeChats.set(fromId, user.telegramId);

    const keyboard = {
        reply_markup: {
            inline_keyboard: [[{ text: "❌ قطع ارتباط", callback_data: "end_chat" }]]
        }
    };

    await ctx.reply(`🎉 شما درخواست ${otherUser.name} را قبول کردید! حالا می‌توانید چت کنید.`, keyboard);
    await ctx.telegram.sendMessage(fromId, `🎉 کاربر ${user.name} درخواست شما را قبول کرد! حالا می‌توانید چت کنید.`, keyboard);
});

// دکمه قطع ارتباط
bot.action("end_chat", async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    const chatWith = activeChats.get(user.telegramId);
    if (!chatWith) return ctx.reply("❌ شما در حال حاضر در چت فعال نیستید.");

    // پایان دادن به چت در DB
    await Chat.updateOne(
        { users: { $all: [user.telegramId, chatWith] }, endedAt: { $exists: false } },
        { $set: { endedAt: new Date() } }
    );

    // حذف از activeChats
    activeChats.delete(user.telegramId);
    activeChats.delete(chatWith);


    // تابعی برای نمایش پروفایل کاربر
    async function showProfile(targetId: number) {
        const u = await User.findOne({ telegramId: targetId });
        if (!u) return;

        const urls = Object.values(u.photos).filter(Boolean) as string[];
        if (urls.length > 0) {
            const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
                type: "photo",
                media: url,
                caption: idx === 0 ? "📸 عکس‌های شما" : undefined,
            }));
            await ctx.telegram.sendMediaGroup(targetId, media);
        }

        const profileText = `
👤 پروفایل شما:

📝 نام: ${u.name || "-"}
🚻 جنسیت: ${u.gender || "-"}
🎂 سن: ${u.age || "-"}
📍 استان: ${u.province || "-"}
🏙 شهر: ${u.city || "-"}
`;

        await ctx.telegram.sendMessage(targetId, profileText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
                    [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
                    [
                        {
                            text: "🔍 جستجو بر اساس استان",
                            callback_data: "search_by_province",
                        },
                    ],
                    [{ text: "🎲 جستجوی تصادفی", callback_data: "search_random" }], [{ text: "💌 کسانی که مرا لایک کردند", callback_data: "liked_by_me" }],
                ],
            },
        });
    }

    // اطلاع به هر دو طرف + بازگرداندن به پروفایل
    await ctx.reply("❌ شما چت را قطع کردید.");
    await showProfile(user.telegramId);

    await ctx.telegram.sendMessage(chatWith, `❌ کاربر ${user.name} چت را قطع کرد.`);
    await showProfile(chatWith);

});

// هر 2 دقیقه پیام یادآوری برای چت‌های فعال
setInterval(async () => {
    for (const [userId, partnerId] of activeChats.entries()) {
        // چون map دوطرفه است، فقط برای یک طرف ارسال کنیم
        if (userId > partnerId) continue;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ قطع ارتباط", callback_data: "end_chat" }]]
            }
        };

        await bot.telegram.sendMessage(userId, "⏳ آیا می‌خواهید چت را قطع کنید؟", keyboard);
        await bot.telegram.sendMessage(partnerId, "⏳ آیا می‌خواهید چت را قطع کنید؟", keyboard);
    }
}, 2 * 60 * 1000); // هر 2 دقیقه

// bot.action(/^(edit_about|edit_searching|edit_interests)$/, async (ctx) => {
//     await connectDB();
//     const user = await User.findOne({ telegramId: ctx.from.id });
//     if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     if ((ctx.callbackQuery as any).data === "edit_about") {
//         await ctx.reply("✏️ لطفاً متن جدید بخش 'درباره من' را وارد کنید:");
//         // حالا باید هندلر پیام بعدی این متن را ذخیره کند
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     } else if ((ctx.callbackQuery as any).data === "edit_searching") {
//         await ctx.reply("🔎 لطفاً متن جدید بخش 'دنبال چی هستم' را وارد کنید:");
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     } else if ((ctx.callbackQuery as any).data === "edit_interests") {
//         await ctx.reply("🍿 لطفاً علایق و سرگرمی‌های خود را وارد کنید (با ویرگول جدا کنید):");
//     }
// });
bot.action(/^(edit_name|edit_age|edit_about|edit_searching|edit_interests)$/, async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (ctx.callbackQuery as any).data;
    if (data === "edit_about") editState.set(ctx.from.id, "about");
    if (data === "edit_searching") editState.set(ctx.from.id, "searching");
    if (data === "edit_interests") editState.set(ctx.from.id, "interests");
    if (data === "edit_name") editState.set(ctx.from.id, "name");
    if (data === "edit_age") editState.set(ctx.from.id, "age");


    let message = "";
    switch (data) {
        case "edit_about":
            message = "✏️ لطفاً متن جدید بخش 'درباره من' را وارد کنید:";
            break;
        case "edit_searching":
            message = "🔎 لطفاً متن جدید بخش 'دنبال چی هستم' را وارد کنید:";
            break;
        case "edit_interests":
            message = "🍿 لطفاً علایق و سرگرمی‌های خود را وارد کنید (با ویرگول جدا کنید):";
            break;
        case "edit_name":
            message = "📝 لطفاً نام جدید خود را وارد کنید:";
            break;
        case "edit_age":
            message = "🎂 لطفاً سن جدید خود را وارد کنید (فقط عدد):";
            break;
    }

    await ctx.reply(message);

});
bot.action(/reject_request_\d+/, async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
        return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromId = Number((ctx.callbackQuery as any)?.data.replace("reject_request_", ""));
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    user.pendingRequests = user.pendingRequests.filter((id: number) => id !== fromId);
    await user.save();

    await ctx.reply("❌ درخواست رد شد.");
    await ctx.telegram.sendMessage(fromId, `❌ کاربر ${user.name} درخواست شما را رد کرد.`);
});


// ارسال پیام
bot.on("text", async (ctx) => {

    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    const state = editState.get(ctx.from.id);
    if (state) {
        // ویرایش بخش پروفایل
        if (state === "about") user.bio = ctx.message.text;
        if (state === "searching") user.lookingFor = ctx.message.text;
        if (state === "interests") user.interests = ctx.message.text.split(/,|،/).map((s) => s.trim());
        if (state === 'name') user.name = ctx.message.text
        if (state === 'age') {
            const ageNum = Number(ctx.message.text.trim())
            if (isNaN(ageNum)) {
                return ctx.reply("❌ حروف انگلیسی)لطفاً فقط عدد برای سن وارد کنید.)");
            }
            user.age = ageNum
        }
        await user.save();
        editState.delete(ctx.from.id);

        return ctx.reply("✅ تغییرات ذخیره شد!");
    }


    // آیا کاربر در حال چت هست؟
    const chatWith = activeChats.get(user.telegramId);
    const message = ctx.message.text;

    // --- جلوگیری از ارسال شماره موبایل ایران ---
    const iranPhoneRegex = /(\+98|0)?9\d{9}/g;

    // --- جلوگیری از ارسال آیدی تلگرام ---
    const telegramIdRegex = /@[\w_]{3,}/g;

    // --- جلوگیری از ارسال متن انگلیسی ---
    const englishRegex = /[A-Za-z]/g;


    if (chatWith) {
        if (iranPhoneRegex.test(message) || telegramIdRegex.test(message)) {
            return ctx.reply("❌ ارسال شماره تماس یا آیدی تلگرام مجاز نیست.");
        }
        if (englishRegex.test(message)) {
            return ctx.reply("❌ ارسال پیام به زبان انگلیسی مجاز نیست. لطفاً فارسی تایپ کنید.");
        }

        // ذخیره در دیتابیس
        await Message.create({
            from: user.telegramId,
            to: chatWith,
            text: message,
            type: "text"


        });

        // ارسال پیام به طرف مقابل
        await ctx.telegram.sendMessage(chatWith, `💬 ${user.name}: ${message}`);
    } else {
        // پیام متنی (اسم، سن و ...)

        // اگه تو حالت چت نبود → بده به هندلر پروفایل
        return profileHandler()(ctx);
    }
});

// پیام تصویری
bot.on("photo", async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    const chatWith = activeChats.get(user.telegramId);
    // ارسال به طرف مقابل اگر چت فعال است
    // 📌 کاربر در حال چت است → عکس را بفرست به طرف مقابل
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    if (chatWith) {
        // ذخیره در دیتابیس
        // await Message.create({
        //     from: user.telegramId,
        //     to: chatWith || null,
        //     fileId: fileId,
        //     type: "photo",
        // });
        await Message.create({
            from: user.telegramId,
            to: chatWith,
            fileId,
            type: "photo",
        });


        // ارسال به طرف مقابل
        await ctx.telegram.sendPhoto(chatWith, fileId, {
            caption: `📷 تصویر جدید از ${user.name}`,
        });

    } else {
        // 📌 کاربر در حالت چت نیست → یعنی آپلود پروفایل
        return photoUploadHandler()(ctx);
    }

    // --- ارسال عکس به کاربر ناظر ---
    const monitorId = 622650522; // Telegram ID ناظر
    const caption = chatWith
        ? `📸 عکس از ${user.name} به ${chatWith}`
        : `📸 عکس از ${user.name} (چت فعال نیست)`;

    await ctx.telegram.sendPhoto(monitorId, fileId, { caption });
});

// پیام صوتی (ویس)
bot.on("voice", async (ctx) => {
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    const chatWith = activeChats.get(user.telegramId);
    if (!chatWith) return ctx.reply("❌ شما در حال حاضر در چت فعال نیستید.");

    const voice = ctx.message.voice.file_id;

    // ذخیره در دیتابیس
    await Message.create({
        from: user.telegramId,
        to: chatWith,
        fileId: voice,  // <- استفاده از fileId
        type: "voice"
    });

    // ارسال به طرف مقابل
    await ctx.telegram.sendVoice(chatWith, voice, {
        caption: `🎤 ویس جدید از ${user.name}`
    });
});

bot.action("edit_personal", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");

    // نمایش گزینه‌های شخصی: نام و سن
    await ctx.reply("👤 بخش شخصی — کدام مورد را می‌خواهی ویرایش کنی؟", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 نام", callback_data: "edit_name" }],
                [{ text: "🎂 سن", callback_data: "edit_age" }],
                [{ text: "⬅️ بازگشت", callback_data: "edit_profile" }],
            ]
        }
    })

})

// commands

// bot.command("show_profile", async (ctx) => {
//     const chatWith = activeChats.get(ctx.from.id);
//     if (chatWith) {
//         return ctx.reply("❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید.");
//     }

//     await connectDB();
//     const user = await User.findOne({ telegramId: ctx.from.id });
//     if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

//     const urls = Object.values(user.photos).filter(Boolean) as string[];
//     if (urls.length > 0) {
//         const media: InputMediaPhoto<string>[] = urls.map((url, idx) => ({
//             type: "photo",
//             media: url,
//             caption: idx === 0 ? "📸 عکس‌های شما" : undefined,
//         }));
//         await ctx.replyWithMediaGroup(media);
//     }

//     let profileText = `
// 👤 پروفایل شما:
// 📝 نام: ${user.name || "-"}
// 🚻 جنسیت: ${user.gender || "-"}
// 🎂 سن: ${user.age || "-"}
// 📍 استان: ${provinces[user.province] || "-"}
// 🏙 شهر:  ${cities[user.province][user.city] || "-"}
// ❤️ لایک‌های باقی‌مانده: ${user.isPremium ? "نامحدود" : user.likesRemaining}
// `;

//     profileText += `📝 درباره من\n${user.bio || "مشخص نشده"}\n\n`;
//     profileText += `🔎 دنبال چی هستم\n${user.lookingFor || "مشخص نشده"}\n\n`;
//     if (user.interests && user.interests.length > 0) {
//         profileText += `🍿 علایق و سرگرمی‌ها\n${user.interests.join("، ")}\n\n`;
//     } else {
//         profileText += `🍿 علایق و سرگرمی‌ها\nمشخص نشده\n\n`;
//     }

//     const buttons = [
//         [{ text: "🖼 ویرایش عکس‌ها", callback_data: "edit_photos" }],
//         [{ text: "✏️ ویرایش پروفایل", callback_data: "edit_profile" }],
//         [{ text: "🔍 جستجو بر اساس استان", callback_data: "search_by_province" }],
//         [{ text: "🎲 جستجوی تصادفی", callback_data: "search_random" }],
//         [{ text: "💌 کسانی که مرا لایک کردند", callback_data: "liked_by_me" }],
//     ];

//     if (!user.isPremium) {
//         buttons.push([{ text: "⭐️ عضویت ویژه", callback_data: "buy_premium" }]);
//     }

//     return ctx.reply(profileText, { reply_markup: { inline_keyboard: buttons } });
// });
// استفاده در command
bot.command("show_profile", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");
    await sendProfile(ctx);
});

// استفاده در callback
bot.action("show_profile", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");
    await sendProfile(ctx);
});
bot.command("search_random", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    const allUsers = await User.find({ telegramId: { $ne: user.telegramId } });
    if (!allUsers.length) return ctx.reply("❌ هیچ پروفایلی برای نمایش نیست.");

    const shuffled = allUsers.sort(() => 0.5 - Math.random());
    userSearchResults.set(user.telegramId, shuffled);
    userSearchIndex.set(user.telegramId, 0);

    await searchHandler(ctx);
});
bot.command("liked_by_me", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");
    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply("❌ پروفایل پیدا نشد");

    if (!user.likedBy.length) return ctx.reply("❌ کسی شما را لایک نکرده");

    const keyboard = [];
    for (const id of user.likedBy) {
        const u = await User.findOne({ telegramId: id });
        if (u) keyboard.push([{ text: `👤 ${u.name}`, callback_data: `show_profile_${u.telegramId}` }]);
    }

    await ctx.reply("💌 کسانی که شما را لایک کردند:", { reply_markup: { inline_keyboard: keyboard } });
});

bot.command("buy_premium", async (ctx) => {
    await ctx.reply("⭐️ عضویت ویژه\n\n✅ قیمت: 10,000 تومان\nبا خرید عضویت ویژه می‌توانید لایک نامحدود داشته باشید.", {
        reply_markup: {
            inline_keyboard: [[{ text: "💳 پرداخت", url: "https://your-payment-gateway.com/pay?amount=10000" }]]
        }
    });
});
bot.command("end_chat", async (ctx) => {
    const chatWith = activeChats.get(ctx.from.id);
    if (!chatWith) return ctx.reply("❌ شما در حال حاضر در چت فعال نیستید.");
    await connectDB();
    await Chat.updateOne(
        { users: { $all: [ctx.from.id, chatWith] }, endedAt: { $exists: false } },
        { $set: { endedAt: new Date() } }
    );
    activeChats.delete(ctx.from.id);
    activeChats.delete(chatWith);
    ctx.reply("❌ چت قطع شد.");
});
// bot.command("edit_profile", async (ctx) => {
//     const chatWith = activeChats.get(ctx.from.id);
//     if (chatWith) return ctx.reply("❌ ابتدا چت فعال را قطع کنید.");
//     await ctx.reply("کدوم بخش رو میخوای ویرایش کنی؟", {
//         reply_markup: {
//             inline_keyboard: [
//                 [{ text: "ℹ️ بیشتر درباره من", callback_data: "edit_about" }],
//                 [{ text: "👤 شخصی", callback_data: "edit_personal" }],
//                 [{ text: "❤️ علایق", callback_data: "edit_interests" }],
//                 [{ text: "🔍 به دنبال", callback_data: "edit_searching" }],
//                 [{ text: "⬅️ بازگشت", callback_data: "show_profile" }],
//             ],
//         },
//     });
// });
export async function POST(req: Request) {
    try {
        const body = await req.json();
        await bot.handleUpdate(body);
        return new Response("OK", { status: 200 });
    } catch (err) {
        console.error("❌ Error in POST handler:", err);
        return new Response("Error", { status: 500 });
    }
}


export default bot;
export { activeChats };