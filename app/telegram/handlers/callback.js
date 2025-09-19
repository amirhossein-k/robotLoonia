// app\telegram\handlers\callback.js
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/model/User";
import { getCityKeyboard } from "@/app/lib/cities";
import { searchHandler } from "./searchHandler";
import { cities } from "@/app/lib/cities";
import { provinces } from "@/app/lib/provinces";
import { activeChats } from "../bot";

export function callbackHandler() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    // ⚠️ اضافه کردن بررسی چت فعال
    const chatWith = activeChats.get(ctx.from.id);
    if (chatWith) {
      return ctx.reply(
        "❌ شما در حال حاضر در یک چت فعال هستید. برای دسترسی به پروفایل ابتدا چت را قطع کنید."
      );
    }

    await connectDB();
    const user = await User.findOne({ telegramId: ctx.from.id });

    if (data === "edit_photos") {
      return ctx.reply("کدوم عکس رو میخوای تغییر بدی؟", {
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

    if (data === "edit_profile") {
      return ctx.reply("کدوم بخش رو میخوای ویرایش کنی؟", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "ℹ️ بیشتر درباره من", callback_data: "edit_about" }],
            [{ text: "👤 شخصی", callback_data: "edit_personal" }],
            [{ text: "❤️ علایق", callback_data: "edit_interests" }],
            [{ text: "🔍 به دنبال", callback_data: "edit_searching" }],
            [{ text: "⬅️ بازگشت", callback_data: "show_profile" }],
          ],
        },
      });
    }

    // قوانین
    if (data === "terms") {
      await ctx.answerCbQuery();
      return ctx.reply(
        "📜 قوانین استفاده از ربات:\n\n1️⃣ احترام به سایر کاربران الزامی است.\n2️⃣ محتوای نامناسب مجاز نیست.\n3️⃣ تخلف باعث مسدود شدن می‌شود.\n\n✅ با ادامه استفاده، شما قوانین را پذیرفته‌اید."
      );
    }

    // دکمه آپلود عکس
    if (data === "upload_photos") {
      await ctx.answerCbQuery();
      return ctx.reply("📸 یکی از گزینه‌های زیر رو انتخاب کن:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📷 عکس ۱", callback_data: "photo_slot_1" }],
            [{ text: "📷 عکس ۲", callback_data: "photo_slot_2" }],
            [{ text: "📷 عکس ۳", callback_data: "photo_slot_3" }],
          ],
        },
      });
    }

    // مرحله ۲: انتخاب جنسیت
    if (data.startsWith("gender_") && user?.step === 2) {
      user.gender = data === "gender_male" ? "male" : "female"; // تغییر به انگلیسی
      user.step = 3;
      await user.save();

      await ctx.answerCbQuery();
      return ctx.reply("📌 مرحله ۳ از ۵: سنت رو وارد کن (عدد):");
    }

    // مرحله ۴: انتخاب استان
    if (
      ctx.callbackQuery?.data.startsWith("profile_province_") &&
      user?.step === 4
    ) {
      const provinceKey = data.replace("profile_province_", "");
      user.province = provinceKey;
      user.step = 5;
      await user.save();

      await ctx.answerCbQuery();
      return ctx.reply(
        "📌 مرحله ۵ از ۵: شهرت رو انتخاب کن:",
        getCityKeyboard(provinceKey)
      );
    }

    // مرحله ۵: انتخاب شهر
    if (data.startsWith("profile_city_") && user?.step === 5) {
      const parts = data.split("_");
      // حذف profile و city → مابقی میشه [provinceKey..., cityKey]
      const provinceAndCity = parts.slice(2);
      const provinceCode = provinceAndCity.slice(0, -1).join("_"); // همه‌ی بخش‌ها به جز آخری
      const cityCode = provinceAndCity.slice(-1)[0]; // آخرین بخش = شهر

      user.province = provinceCode;
      user.city = cityCode;
      user.step = 6; // پروفایل تکمیل شد
      await user.save();
      const genderText =
        user.gender === "male" ? "مرد" : user.gender === "female" ? "زن" : "-";

      ctx.answerCbQuery("✅ شهرت انتخاب شد!").catch(() => {});
      return ctx.reply(
        `✅ پروفایلت ساخته شد!\n\n👤 نام: ${
          user.name
        }\n👫 جنسیت: ${genderText}\n🎂 سن: ${user.age}\n📍 استان: ${
          provinces[user.province]
        }\n🏙 شهر: ${cities[user.province][user.city]}`,

        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📜 شرایط استفاده", callback_data: "terms" }],
              // [{ text: "📸 آپلود عکس", callback_data: "upload_photos" }],
              [{ text: "پروفایل", callback_data: "show_profile" }],
            ],
          },
        }
      );
    }
    if (data === "search_profiles") {
      return searchHandler(ctx);
    }
    // next و like
    if (data === "next_profile") {
      const index = userSearchIndex.get(ctx.from.id) || 0;
      const results = userSearchResults.get(ctx.from.id);
      if (!results || results.length === 0)
        return ctx.reply("❌ هیچ پروفایلی برای نمایش نیست.");

      const nextIndex = (index + 1) % results.length;
      userSearchIndex.set(ctx.from.id, nextIndex);
      return searchHandler(ctx); // نمایش پروفایل بعدی
    }

    if (data.startsWith("like_")) {
      const likedId = Number(data.replace("like_", ""));
      await connectDB();

      const likedUser = await User.findOne({ telegramId: likedId });
      if (!likedUser) return ctx.reply("❌ کاربر پیدا نشد.");

      // ثبت لایک برای کاربر فعلی
      if (!user.likes.includes(likedId)) {
        user.likes.push(likedId);
        await user.save();
      }

      // بررسی اینکه طرف مقابل هم کاربر فعلی را لایک کرده باشد
      if (
        likedUser.likes.includes(user.telegramId) &&
        !user.matches.includes(likedId)
      ) {
        // اضافه کردن به لیست Match هر دو
        user.matches.push(likedId);
        likedUser.matches.push(user.telegramId);

        await user.save();
        await likedUser.save();

        // اطلاع‌رسانی به هر دو
        await ctx.telegram.sendMessage(
          user.telegramId,
          `🎉 شما با ${likedUser.name} Match شدید! حالا می‌توانید با هم صحبت کنید.`
        );
        await ctx.telegram.sendMessage(
          likedUser.telegramId,
          `🎉 شما با ${user.name} Match شدید! حالا می‌توانید با هم صحبت کنید.`
        );
      } else {
        // فقط لایک ثبت شد
        await ctx.reply("✅ لایک ثبت شد!");
      }
      return;
    }
  };
}
