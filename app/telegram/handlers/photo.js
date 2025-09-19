// app\telegram\handlers\photo.js
import { connectDB } from "@/app/lib/mongodb";
import Photo from "@/app/model/Photo";

export function photoHandler(userStates) {
  return async (ctx) => {
    const userState = userStates.get(ctx.from.id) || { waitingForPhoto: false };
    if (!userState.waitingForPhoto) {
      return ctx.reply("لطفاً اول دکمه آپلود را بزنید!");
    }

    const photo = ctx.message.photo.pop();
    const fileId = photo.file_id;

    try {
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

      ctx.reply("⏳ در حال آپلود عکس...");

      const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/upload`, {
        method: "POST",
        body: JSON.stringify({ url: fileUrl }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!data.success) return ctx.reply("❌ خطا در آپلود به سرور");

      userStates.set(ctx.from.id, { waitingForPhoto: false });

      await connectDB();
      await Photo.create({
        userId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        fileUrl: data.url,
        fileKey: data.Key,
        telegramFileId: fileId,
      });

      await ctx.replyWithPhoto(data.url, {
        caption: "✅ آپلود موفق شد!",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🗑 حذف عکس", callback_data: `delete_${data.Key}` }],
          ],
        },
      });
    } catch (err) {
      console.error("❌ Error uploading:", err);
      ctx.reply("❌ خطا در آپلود عکس");
    }
  };
}
