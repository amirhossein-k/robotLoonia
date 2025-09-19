// app/handlers/photoHandler.ts
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";

const userPhotoState = new Map<number, string>(); // userId → slot (slot1, slot2, slot3)

export function setPhotoSlotHandler() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (ctx: any) => {
        const data = ctx.callbackQuery?.data;
        if (!data) return;

        await connectDB();

        if (data.startsWith("photo_slot_")) {

            const slot = data.replace("photo_slot_", "slot");

            let user = await User.findOne({ telegramId: ctx.from.id });
            if (!user) {
                user = await User.create({
                    telegramId: ctx.from.id,
                    step: 1,
                });
            }
            // وضع انتظار برای آپلود را در دیتابیس ذخیره کن
            user.awaitingPhotoSlot = slot;
            await user.save();

            await ctx.answerCbQuery();
            // return ctx.reply("📸 حالا عکس مورد نظرت رو ارسال کن.");
            return ctx.reply("📸 حالا عکس مورد نظر را ارسال کنید.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⬅️ بازگشت", callback_data: "edit_photos" }],
                    ],
                },
            });

        }
        // دکمه بازگشت به منوی ویرایش عکس
        if (data === "back_to_photo_menu") {
            return ctx.reply("📸 کدام عکس را می‌خواهی تغییر بدهی؟", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📸 عکس ۱", callback_data: "photo_slot_1" }],
                        [{ text: "📸 عکس ۲", callback_data: "photo_slot_2" }],
                        [{ text: "📸 عکس ۳", callback_data: "photo_slot_3" }],
                        [{ text: "⬅️ بازگشت", callback_data: "show_profile" }],
                    ],
                },
            });
        }

    };
}
// هندل آپلود خود عکس (پیامی که شامل photo است)

// هندل آپلود خود عکس (پیامی که شامل photo است)
export function photoUploadHandler() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (ctx: any) => {
        try {
            await connectDB();
            const user = await User.findOne({ telegramId: ctx.from.id });
            if (!user) return ctx.reply("❌ لطفاً ابتدا پروفایل خود را ایجاد کنید.");
            console.log("👉 photoUploadHandler triggered for", ctx.from.id);

            const slot = user.awaitingPhotoSlot;
            if (!slot) {
                return ctx.reply("❌ ابتدا یکی از اسلات‌ها را انتخاب کنید (عکس ۱، ۲ یا ۳).");
            }

            const photo = ctx.message?.photo;
            if (!photo || !photo.length) return ctx.reply("❌ لطفاً یک عکس ارسال کنید.");
            console.log(photo, 'photo')
            const largest = photo[photo.length - 1];
            console.log(largest, 'largest')
            const fileId = largest.file_id;
            console.log('fileId', fileId)
            const file = await ctx.telegram.getFile(fileId);
            console.log(file, 'file')
            const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            console.log("fileUrl from Telegram:", fileUrl);

            // --- ارسال به API آپلود خودت (تا در S3 ذخیره بشه) ---
            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: fileUrl }),
            });

            const uploadText = await uploadRes.text();
            let uploadData;
            try {
                uploadData = JSON.parse(uploadText);
                console.log("uploadData from /api/upload:", uploadData);

            } catch {
                console.error("Upload response not JSON:", uploadText);
                return ctx.reply("❌ خطا در آپلود (پاسخ سرور نامعتبر است).");
            }

            if (!uploadData.success) {
                console.error("Upload failed:", uploadData);
                return ctx.reply("❌ خطا در آپلود به سرور.");
            }

            // ذخیره لینک نهایی در DB زیر اسلات مناسب
            user.photos = user.photos || {};
            user.photos[slot] = uploadData.url; // یا uploadData.url یا همان data.url که سرورت برمی‌گرداند
            user.awaitingPhotoSlot = null; // پاک کردن حالت انتظار
            await user.save();

            await ctx.replyWithPhoto(uploadData.url, {
                caption: `✅ عکس با موفقیت در ${slot} ذخیره شد.`,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⬅️ بازگشت به منوی عکس‌ها", callback_data: "edit_photos" }],
                    ],
                },
            });
        } catch (err) {
            console.error("❌ Error in photoUploadHandler:", err);
            return ctx.reply("❌ خطا در پردازش عکس. دوباره تلاش کنید.");
        }
    };
}