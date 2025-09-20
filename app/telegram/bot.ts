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
bot.action(["edit_photos", "edit_profile", "address", "upload_photos"], callbackHandler());
bot.action(["photo_slot_1", "photo_slot_2", "photo_slot_3", "back_to_photo_menu"], setPhotoSlotHandler());
bot.action([
    "edit_photos",
    "edit_profile",
    "address",
    "upload_photos",
    "list",
    "next_products",
    "prev_products",
    "admin_add_product",
    "admin_orders",
    "orders_pending",
    "orders_approved"
], callbackHandler());
// همچنین برای دکمه‌هایی که dynamic هستن:
bot.action(/^(order_|approve_|reject_|chat_)\w+/, callbackHandler());
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



// ارسال پیام
bot.on("text", async (ctx) => {

    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return;

    // ---- مدیریت مراحل آدرس ----
    if (user.step === "address_province") {
        user.provinceText = ctx.message.text.trim();
        user.step = "address_city";
        await user.save();
        console.log(`[DEBUG] Province set: ${user.provinceText}, step to address_city`);
        return ctx.reply("🏙 لطفاً نام شهر خود را وارد کنید:");
    }

    if (user.step === "address_city") {
        user.cityText = ctx.message.text.trim();
        user.step = "address_postal_address";
        await user.save();
        console.log(`[DEBUG] City set: ${user.cityText}, step to address_postal_address`);
        return ctx.reply("📍 لطفاً آدرس پستی دقیق خود را وارد کنید:");
    }

    if (user.step === "address_postal_address") {
        user.postalAddress = ctx.message.text.trim();
        user.step = "address_postal_code";
        await user.save();
        console.log(`[DEBUG] Postal address set: ${user.postalAddress}, step to address_postal_code`);
        return ctx.reply("🔢 لطفاً کد پستی خود را وارد کنید:");
    }

    if (user.step === "address_postal_code") {
        user.postalCode = ctx.message.text.trim();
        user.profileSet = "6"; // یا هر step که نشان‌دهنده تکمیل باشد (مثلاً برگشت به پروفایل کامل)
        await user.save();
        const profileText = `
        ✅ اطلاعات آدرس شما با موفقیت ذخیره شد!
        👤 پروفایل شما:
        📝 نام: ${user.name || "-"}
        📍 استان: ${user.provinceText || "-"}
        🏙 شهر:  ${user.cityText || "-"}
        ادرس پستی :  ${user.postalAddress || "-"}
        کد پستی :  ${user.postalCode || "-"}

        `;
        const buttons = [
            [{ text: "پروفایل", callback_data: "edit_photos" }],
            [{ text: "✏️ ویرایش ادرس", callback_data: "address" }],
            [{ text: "محصولات", callback_data: "list_products" }],
            [{ text: "پیگیری سفارش", callback_data: "peigiri" }],
            [
                {
                    text: "دسته بندی",
                    callback_data: "category",
                },
            ],
        ];
        console.log(`[DEBUG] Postal code set: ${user.postalCode}, address completed`);
        await ctx.reply(profileText, { reply_markup: { inline_keyboard: buttons } });


    }

    // add prodcut by admin
    // 🛠 مراحل افزودن محصول (فقط مدیر)
    if (user.step === "add_product_title") {
        user.tempProduct = { title: ctx.message.text };
        user.step = "add_product_description";
        await user.save();
        return ctx.reply("📝 توضیح محصول را وارد کنید:");
    }

    if (user.step === "add_product_description") {
        user.tempProduct.description = ctx.message.text;
        user.step = "add_product_price";
        await user.save();
        return ctx.reply("💰 قیمت محصول را وارد کنید:");
    }

    if (user.step === "add_product_price") {
        user.tempProduct.price = ctx.message.text;
        user.step = "add_product_category";
        await user.save();
        return ctx.reply("دسته بندی محصول را وارد کنید:");
    }
    if (user.step === "add_product_category") {
        user.tempProduct.category = ctx.message.text;
        user.step = "add_product_size";
        await user.save();
        return ctx.reply("📏 اندازه محصول را وارد کنید:");
    }
    if (user.step === "add_product_size") {
        user.tempProduct.size = ctx.message.text;
        user.step = "add_product_photo";
        await user.save();
        return ctx.reply("📸 لطفاً عکس محصول را ارسال کنید:");
    }
    // if (user.step === "add_product_size") {
    //     user.tempProduct.size = ctx.message.text;
    //     user.step = "add_product_photo";
    //     await user.save();
    //     return ctx.reply("📸 لطفاً عکس محصول را ارسال کنید:");
    // }

    // 

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
        //ارسال پیام به طرف مقابل
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
        console.log(`[DEBUG]  photoUploadHandler `)
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


// استفاده در command

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