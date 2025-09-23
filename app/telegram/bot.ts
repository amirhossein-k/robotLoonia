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
import Product from "@/app/model/product";

import Message from "@/app/model/Message";
import Chat from "../model/Chat";
import { getProvinceKeyboard, provinces } from "../lib/provinces";
import { cities, getCityKeyboard } from "../lib/cities";
import Order from "../model/Order";
import { findTelegramIdByName } from "../utiles/morethan";
const activeChats = new Map<number, number>();
const editState = new Map<number, "about" | "searching" | "interests" | "name" | "age">();

// Map برای نگه داشتن حالت منتظر دلیل رد
const waitingForRejectReason = new Map<number, string>();
// key = adminId, value = orderId
// مپ موقت برای ذخیره اینکه کدوم سفارش منتظر کد پیگیریه
const waitingForTracking = new Map();

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
    "list_products",   // 🔥 اینو اضافه کن
    "next_products",
    "prev_products",
    "admin_add_product",
    "admin_orders",
    "orders_pending",
    // "approve_order_",
    "orders_approved"
], callbackHandler());

// ========================
// مرحله 3: ادمین تایید/رد محصول
// ========================
bot.action(/approve_product_(.+)/, async (ctx) => {
    await connectDB(); // ⭐ حتما اضافه کن

    const orderId = ctx.match[1];
    const order = await Order.findById(orderId).populate("userId productId");
    order.status = "awaiting_payment";
    await order.save();

    await ctx.telegram.sendMessage(order.userId.telegramId,
        `✅ ادمین محصول شما را تایید کرد.
💰 لطفا مبلغ ${order.productId.price} را به شماره حساب X واریز کرده و رسید را ارسال کنید.`
    );
    // پاک کردن پیام از چت ادمین
    await ctx.deleteMessage();

    await ctx.answerCbQuery("محصول تایید شد.");
});
bot.action(/reject_product_(.+)/, async (ctx) => {
    await connectDB(); // ⭐ حتما اضافه کن

    const orderId = ctx.match[1];
    const order = await Order.findById(orderId).populate("userId productId");
    if (!order) return ctx.answerCbQuery("❌ سفارش پیدا نشد.");

    // order.status = "rejected";
    // await order.save();
    // ذخیره سفارش در حالت انتظار دلیل


    // منتظر دلیل توسط ادمین
    order.awaitingRejectReason = true;
    order.rejectReasonAdminId = ctx.from.id;
    await order.save();

    console.log(`[DEBUG] ${waitingForRejectReason} - ذخیره سفارش در حالت انتظار دلیل`)
    await ctx.reply("لطفا دلیل رد کردن محصول را بنویسید:");
    await ctx.answerCbQuery("لطفا دلیل رد را وارد کنید.");
    // await ctx.telegram.sendMessage(order.userId.telegramId, `❌ محصول شما توسط ادمین رد شد.`);
    // await ctx.answerCbQuery("محصول رد شد.");
});
// ========================
// مرحله 5: ادمین تایید/رد فیش
// ========================
bot.action(/confirm_receipt_(.+)/, async (ctx) => {
    await connectDB(); // 👈 حتما بزن

    const orderId = ctx.match[1];
    const order = await Order.findById(orderId).populate("userId productId");
    order.status = "approved";
    await order.save();

    await ctx.telegram.sendMessage(order.userId.telegramId,
        `✅ سفارش شما تایید شد.
📦 پس از ارسال، کد رهگیری برای شما ارسال خواهد شد.
از خرید شما سپاسگزاری در کمترین زمان برای شما ارسال خواهد شد
` , {
        reply_markup: {
            inline_keyboard: [
                [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }],

            ]
        }
    }
    );
    // پاک کردن پیام از چت ادمین
    await ctx.deleteMessage();
    await ctx.answerCbQuery("فیش تایید شد.");
});

bot.action(/reject_receipt_(.+)/, async (ctx) => {
    console.log(` [DEBUG] /reject_receipt_(.+)/`)
    await connectDB(); // 👈 حتما بزن

    const targetName = '09391470427'
    const telegramId = await findTelegramIdByName(targetName);
    if (!telegramId) {
        await ctx.reply("❌ کاربر پیدا نشد!");
        return ctx.answerCbQuery();
    }

    const orderId = ctx.match[1];
    const order = await Order.findById(orderId).populate("userId productId");
    if (!order) return ctx.answerCbQuery("❌ سفارش پیدا نشد.");

    order.status = "payment_rejected";
    await order.save();


    await ctx.telegram.sendMessage(order.userId.telegramId, `❌ فیش واریزی شما تایید نشد. لطفا دوباره اقدام کنید.`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "💳 اقدام دوباره", callback_data: `retry_payment_${order._id}` },
                    { text: "💬 چت با ادمین", callback_data: `chat_${telegramId}` },
                ],
                [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }],
            ]
        }
    });

    await ctx.answerCbQuery("فیش رد شد.");
});
// دکمه اقدام دوباره
bot.action(/retry_payment_(.+)/, async (ctx) => {
    await connectDB(); // 👈 اینو یادت رفته بود

    console.log(`[DEBUG] /retry_payment_(.+)/`)
    const orderId = ctx.match[1];
    const order = await Order.findById(orderId).populate("userId productId");;
    if (!order) return ctx.answerCbQuery("❌ سفارش پیدا نشد.");

    order.status = "awaiting_payment"; // وضعیت دوباره آماده بررسی
    await order.save();

    await ctx.telegram.sendMessage(order.userId.telegramId, "💳 لطفا دوباره رسید خود را ارسال کنید.");
    await ctx.answerCbQuery("وضعیت سفارش بروزرسانی شد.");
});
// پیام ارسال شد و اضافه کردن کد رهگیری پستی
bot.action(/send_tracking_(.+)/, async (ctx) => {
    await connectDB();
    const orderId = ctx.match[1];
    const order = await Order.findById(orderId);

    if (!order) return ctx.reply("❌ سفارش پیدا نشد.");

    order.awaitingTrackingCode = true;
    order.trackingAdminId = ctx.from.id;
    await order.save();

    await ctx.reply("📮 لطفاً کد پیگیری مرسوله را وارد کنید:");
    await ctx.answerCbQuery();

});
bot.action("admin_menu", async (ctx) => {
    await ctx.reply("📌 منوی مدیریت:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ افزودن محصول", callback_data: "admin_add_product" }],
                [{ text: "📦 لیست محصولات", callback_data: "list" }],
                [{ text: "🛒 لیست سفارشات", callback_data: "admin_orders" }],
            ],
        },
    });
    await ctx.answerCbQuery(); // برای بستن لودینگ تلگرام
});
bot.action("user_menu", async (ctx) => {
    const targetName = '09391470427'
    const telegramId = await findTelegramIdByName(targetName);
    if (!telegramId) {
        await ctx.reply("❌ کاربر پیدا نشد!");
        return ctx.answerCbQuery();
    }
    await connectDB();

    // 🟢 یوزر فعلی
    const userTelegramId = ctx.from.id;
    const user = await User.findOne({ telegramId: userTelegramId });

    // 🟢 سفارش آخر کاربر
    const lastOrder = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 });


    // دکمه‌های پیش‌فرض
    const buttons = [
        [{ text: "محصولات", callback_data: "list" }],
        [
            { text: "پیگیری سفارش", callback_data: "peigiri" },
            { text: "💬 چت با ادمین", callback_data: `chat_${telegramId}` },
        ],
        [{ text: "آدرس", callback_data: "address" }],
    ];
    // 🟢 فقط اگر سفارش هست و وضعیتش approved نیست
    if (lastOrder && lastOrder.status !== "approved") {
        buttons.push([
            { text: "🔙 ادامه فرایند قبلی", callback_data: `resume_${lastOrder._id}` }
        ]);
        buttons.push([
            { text: "❌ لغو سفارش", callback_data: `cancel_${lastOrder._id}` }
        ]);
    }



    await ctx.reply("📌 منوی فروشگاه:", {
        reply_markup: { inline_keyboard: buttons },
    });

    await ctx.answerCbQuery(); // برای بستن لودینگ تلگرام
});

bot.action(/cancel_(.+)/, async (ctx) => {
    await connectDB();

    const orderId = ctx.match[1];

    const order = await Order.findById(orderId);
    if (!order) {
        await ctx.reply("❌ سفارش پیدا نشد!");
        return ctx.answerCbQuery();
    }

    if (order.status === "approved") {
        await ctx.reply("✅ این سفارش قبلاً تأیید شده و قابل لغو نیست.");
        return ctx.answerCbQuery();
    }

    // حذف سفارش از دیتابیس
    await Order.deleteOne({ _id: orderId });

    await ctx.reply("❌ سفارش شما با موفقیت لغو شد.");
    await ctx.answerCbQuery();
});

bot.action(/resume_(.+)/, async (ctx) => {
    await connectDB();

    const orderId = ctx.match[1];

    const order = await Order.findById(orderId).populate("productId userId");
    if (!order) {
        await ctx.reply("❌ سفارش پیدا نشد!");
        return ctx.answerCbQuery();
    }



    const targetName = '09391470427'
    const telegramId = await findTelegramIdByName(targetName);
    if (!telegramId) {
        await ctx.reply("❌ کاربر پیدا نشد!");
        return ctx.answerCbQuery();
    }



    // بررسی وضعیت سفارش و ادامه فرایند
    switch (order.status) {
        case "awaiting_payment":
            await ctx.reply(
                "💳 سفارش شما هنوز در انتظار پرداخت است.\nلطفاً فیش واریزی را ارسال کنید."
            );
            break;

        case "payment_rejected":
            await ctx.reply(
                "❌ فیش پرداختی قبلی شما رد شد.\nلطفاً دوباره اقدام کنید.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "💬 چت با ادمین", callback_data: `chat_${telegramId}` },
                                { text: "💳 اقدام دوباره", callback_data: `retry_payment_${order._id}` }
                            ],
                            [
                                { text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }
                            ]
                        ]
                    }
                }
            );
            break;

        case "awaiting_tracking_code":
            await ctx.reply(
                "📦 سفارش شما تایید شده است و منتظر دریافت کد رهگیری می‌باشد."
            );
            break;

        default:
            await ctx.reply(
                `📌 وضعیت سفارش شما: ${order.status}\nاین مرحله قابل ادامه دادن نیست.`
            );
            break;
    }

    await ctx.answerCbQuery(); // بستن لودینگ
});

// هندلر چت داینامیک
bot.action(/chat_(\d+)/, async (ctx) => {
    await connectDB();
    const userId = Number(ctx.from.id);

    const targetId = Number(ctx.match[1]); // ID ادمین از callback_data گرفته می‌شود


    // بررسی وجود چت باز
    let chat = await Chat.findOne({
        users: { $all: [userId, targetId] },
        endedAt: { $exists: false }
    });

    // اگر چت باز نبود → ایجاد چت جدید
    if (!chat) {
        chat = await Chat.create({ users: [userId, targetId], messages: [] });
    }

    activeChats.set(Number(ctx.from.id), Number(targetId));
    activeChats.set(Number(targetId), Number(ctx.from.id));
    await ctx.reply("💬 چت با ادمین شروع شد. پیام‌ها مستقیم ارسال می‌شوند.");

    // پیام به ادمین
    await ctx.telegram.sendMessage(
        targetId,
        `💬 کاربر ${ctx.from.first_name} (ID: ${ctx.from.id}) برای گفتگو به شما وصل شد.\n📋 لیست خرید‌ها:`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "کالاهای تایید شده", callback_data: `approved_${ctx.from.id}` }
                    ],
                    [
                        { text: "کالاهای تایید نشده", callback_data: `unapproved_${ctx.from.id}` }
                    ],
                    [
                        { text: "در انتظار تایید", callback_data: `pending_${ctx.from.id}` }
                    ]
                ]
            }
        }
    );
    await ctx.answerCbQuery(); // بستن لودینگ تلگرام
});

// هندلر برای کالاهای تایید شده
bot.action(/approved_(\d+)/, async (ctx) => {
    await connectDB();

    const userId = Number(ctx.match[1]);
    const user = await User.findOne({ telegramId: userId }); // فرض بر اینه User مدل دیتابیس است

    if (!user) return ctx.reply("❌ کاربر پیدا نشد!");

    // فرض بر اینه که user.pendingOrders شامل سفارشات کاربر هست
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // فچ کردن سفارشات تایید شده از مدل Order
    const approvedOrders = await Order.find({
        userId: user._id,
        status: "approved"
    }).populate("productId"); // اگر میخوای نام محصول را هم داشته باشی

    const message = approvedOrders.length
        ? approvedOrders.map((o) => `✅ ${o.productId.title} - تعداد: ${o.quantity || 1}`).join("\n")
        : "❌ کالای تایید شده‌ای وجود ندارد.";

    await ctx.reply(`📋 کالاهای تایید شده:\n${message}`);
    await ctx.answerCbQuery(); // بستن لودینگ
});

// هندلر برای کالاهای تایید نشده کاربر خاص
bot.action(/unapproved_(\d+)/, async (ctx) => {
    await connectDB();

    const userId = Number(ctx.match[1]);
    const user = await User.findOne({ telegramId: userId });

    if (!user) return ctx.reply("❌ کاربر پیدا نشد!");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unapprovedOrders = await Order.find({
        userId: user._id,
        status: "rejected"
    }).populate("productId"); // اگر میخوای نام محصول را هم داشته باشی
    const message = unapprovedOrders.length
        ? unapprovedOrders.map((o) => `❌ ${o.productId.title} - تعداد: ${o.quantity || 1}`).join("\n")
        : "❌ کالای تایید نشده‌ای وجود ندارد.";


    await ctx.reply(`📋 کالاهای تایید نشده:\n${message}`);
    await ctx.answerCbQuery();
});

//  هندلر برای کالاهای در انتظار تایید کاربر خاص
bot.action(/pending_(\d+)/, async (ctx) => {
    await connectDB();

    const userId = Number(ctx.match[1]);
    const user = await User.findOne({ telegramId: userId });

    if (!user) return ctx.reply("❌ کاربر پیدا نشد!");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingProducts = await Order.find({
        userId: user._id,
        status: "pending"
    }).populate("productId"); // اگر میخوای نام محصول را هم داشته باشی

    const message = pendingProducts.length
        ? pendingProducts.map((o) => `✅ ${o.productId.title} - تعداد: ${o.quantity || 1}`).join("\n")
        : "❌ کالای در انتظار تایید وجود ندارد.";

    await ctx.reply(`📋 کالاهای در انتظار تایید:\n${message}`);
    await ctx.answerCbQuery();
});


// دسته‌بندی‌ها رو با regex هندل کن
bot.action(/category_.+/, callbackHandler());
bot.action(/next_productsCategory_.+/, callbackHandler());
bot.action(/prev_productsCategory_.+/, callbackHandler());
// همچنین برای دکمه‌هایی که dynamic هستن:
bot.action(/^(order_|approve_|reject_)\w+/, callbackHandler());
// bot.action(`chat_admin`, callbackHandler());
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

// 4. **هندل خرید عضویت ویژه (buy_premium)**  
// وقتی کاربر دکمه "⭐️ عضویت ویژه" رو بزنه:  
// - پیام قیمت بیاد.  
// - دکمه پرداخت (می‌تونی درگاه پرداخت ایرانی وصل کنی). 


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
    async function showProfile(targetId: number, isAdmin = false) {
        const u = await User.findOne({ telegramId: targetId });
        if (!u) return;

        // ارسال عکس‌ها
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
🎂 سن: ${u.age || "-"}
📍 استان: ${u.province || "-"}
🏙 شهر: ${u.city || "-"}
`;

        // دکمه مناسب
        const keyboard = isAdmin
            ? [[{ text: "⚙️ مدیریت فروشگاه", callback_data: "admin_menu" }]]
            : [[{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }]];

        await ctx.telegram.sendMessage(targetId, profileText, {
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    // اطلاع به هر دو طرف + بازگرداندن به پروفایل
    await ctx.reply("❌ شما چت را قطع کردید.");
    await showProfile(user.telegramId, false); // کاربر

    await ctx.telegram.sendMessage(chatWith, `❌ کاربر ${user.name} چت را قطع کرد.`);
    await showProfile(chatWith, true); // ادمین


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




// ارسال پیام
bot.on("text", async (ctx) => {

    await connectDB();


    const adminId = ctx.from.id;
    // بررسی اینکه ادمین منتظر وارد کردن دلیل برای سفارش است
    const order = await Order.findOne({ awaitingRejectReason: true, rejectReasonAdminId: adminId }).populate("userId productId");
    if (order) {
        const reason = ctx.message.text;
        order.status = "rejected";
        order.rejectReasonText = reason;
        order.awaitingRejectReason = false;
        order.rejectReasonAdminId = null;
        await order.save();

        await ctx.telegram.sendMessage(order.userId.telegramId,
            `❌ محصول شما توسط ادمین رد شد.\n📌 دلیل: ${reason}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "💬 چت با پشتیبانی", callback_data: "chat_admin" }],
                        [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }]
                    ]
                }
            }
        );

        return ctx.reply("✅ دلیل رد محصول به کاربر ارسال شد.");
    }
    // بررسی اینکه ادمین منتظر وارد کردن کد پیگیری است
    const trackingOrder = await Order.findOne({ awaitingTrackingCode: true, trackingAdminId: ctx.from.id }).populate("userId productId");
    if (trackingOrder) {
        const trackingCode = ctx.message.text;

        trackingOrder.trackingCode = trackingCode;
        trackingOrder.awaitingTrackingCode = false;
        trackingOrder.trackingAdminId = null;
        await trackingOrder.save();

        // اطلاع به کاربر
        await ctx.telegram.sendMessage(
            trackingOrder.userId.telegramId,
            `📦 سفارش شما ارسال شد.\n🛒 محصول: ${trackingOrder.productId.title}\n💰 مبلغ: ${trackingOrder.productId.price} تومان\n🔢 کد رهگیری پستی: ${trackingCode}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }],
                    ],
                },
            }
        );

        return ctx.reply("✅ کد پیگیری ثبت و برای کاربر ارسال شد.");
    }

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
        user.step = "done"; // یا هر step که نشان‌دهنده تکمیل باشد (مثلاً برگشت به پروفایل کامل)
        await user.save();
        // اگر محصولی در انتظار بود
        if (user.pendingOrderProductId) {
            const product = await Product.findById(user.pendingOrderProductId);
            user.pendingOrderProductId = null; // ریست
            await user.save();

            if (product) {
                return ctx.replyWithPhoto(product.photoUrl, {
                    caption: `🛍 ${product.title}\n\n${product.description}\n💵 قیمت: ${product.price} تومان\n📏 اندازه: ${product.size}`,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📝 ثبت سفارش", callback_data: `order_${product._id}` }],
                            [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }]

                        ],
                    },
                });
            }
        }
        const profileText = `
        ✅ اطلاعات آدرس شما با موفقیت ذخیره شد!
        👤 پروفایل شما:
        📝 نام: ${user.name || "-"}
        📍 استان: ${user.provinceText || "-"}
        🏙 شهر:  ${user.cityText || "-"}
        ادرس پستی :  ${user.postalAddress || "-"}
        کد پستی :  ${user.postalCode || "-"}

        `;
        // const buttons = [
        //     [{ text: "پروفایل", callback_data: "edit_photos" }],
        //     [{ text: "✏️ ویرایش ادرس", callback_data: "address" }],
        //     [{ text: "محصولات", callback_data: "list" }],
        //     [{ text: "پیگیری سفارش", callback_data: "peigiri" }],

        // ];
        console.log(`[DEBUG] Postal code set: ${user.postalCode}, address completed`);
        await ctx.reply(profileText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⚙️ منوی فروشگاه", callback_data: "user_menu" }],
                ]
            }
        });


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

    // آیا کاربر در حال چت هست؟
    const chatWith = activeChats.get(user.telegramId);
    // const chatWith = activeChats.get(Number(ctx.from.id));

    const message = ctx.message.text;


    if (chatWith) {
        // چت فعال موجود → پیام ذخیره و ارسال
        let chat = await Chat.findOne({ users: { $all: [user.telegramId, chatWith] }, endedAt: { $exists: false } });
        if (!chat) {
            // اگر چت در DB وجود ندارد، یک چت جدید بساز

            chat = await Chat.create({ users: [user.telegramId, chatWith], messages: [] });
        }
        // ذخیره در دیتابیس
        chat.messages.push({
            from: user.telegramId,
            to: chatWith,
            text: ctx.message.text,
            type: "text",
            createdAt: new Date()
        });
        await chat.save();
        //ارسال پیام به طرف مقابل
        await ctx.telegram.sendMessage(chatWith, `💬 ${user.name}: ${message}`, {
            reply_markup: {
                inline_keyboard: [[{ text: "❌ قطع ارتباط", callback_data: "end_chat" }]]
            }
        });
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

    const chatWith = activeChats.get(Number(user.telegramId));
    // ارسال به طرف مقابل اگر چت فعال است
    // 📌 کاربر در حال چت است → عکس را بفرست به طرف مقابل
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    // 1️⃣ اگر کاربر در حال چت است
    if (chatWith) {
        let chat = await Chat.findOne({ users: { $all: [user.telegramId, chatWith] }, endedAt: { $exists: false } });
        if (!chat) chat = await Chat.create({ users: [user.telegramId, chatWith], messages: [] });
        chat.messages.push({
            from: user.telegramId,
            to: chatWith,
            photo: fileId,
            type: "photo",
            createdAt: new Date()
        });
        await chat.save();


        // ارسال به طرف مقابل
        await ctx.telegram.sendPhoto(chatWith, fileId, {
            caption: `📷 تصویر جدید از ${user.name}`, reply_markup: {
                inline_keyboard: [[{ text: "❌ قطع ارتباط", callback_data: "end_chat" }]]
            },
        });
        return; // 👈 اینجا return بزن

    }
    // ========================
    // مرحله 4: کاربر ارسال فیش پرداخت
    // ========================
    // 2️⃣ اگر کاربر در مرحله ارسال رسید پرداخت است
    const pendingOrder = await Order.findOne({ userId: user._id, status: "awaiting_payment" })
        .populate("productId userId");

    if (pendingOrder) {
        pendingOrder.paymentReceipt = fileId;
        pendingOrder.status = "payment_review";
        await pendingOrder.save();

        // اطلاع ادمین
        const ADMIN_ID = 622650522;
        await ctx.telegram.sendPhoto(ADMIN_ID, fileId, {
            caption: `📑 رسید پرداخت سفارش ${pendingOrder._id} از کاربر ${user.name}`,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ تایید رسید", callback_data: `confirm_receipt_${pendingOrder._id}` }],
                    [{ text: "❌ رد رسید", callback_data: `reject_receipt_${pendingOrder._id}` }],
                    [{ text: "⚙️ منوی ادمین", callback_data: "admin_menu" }],
                ],
            },
        });

        await ctx.deleteMessage();

        // --- ارسال عکس به کاربر ناظر ---
        // const monitorId = 622650522; // Telegram ID ناظر
        // const caption = `سفارش جدید ثبت شده لطفا برو تایید کن `

        // await ctx.telegram.sendPhoto(monitorId, fileId, { caption });


        return ctx.reply("📩 رسید شما ثبت شد و در انتظار بررسی ادمین است.");
    }



    // 3️⃣ در غیر اینصورت → آپلود محصول یا پروفایل
    return photoUploadHandler()(ctx);

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
    const chatWith = activeChats.get(Number(ctx.from.id));
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