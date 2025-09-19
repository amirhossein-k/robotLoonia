// app/model/Message.ts
import { Schema, models, model } from "mongoose";

const messageSchema = new Schema(
    {
        from: { type: Number, required: true }, // telegramId فرستنده
        to: { type: Number, required: true },   // telegramId گیرنده
        type: { type: String, enum: ["text", "photo", "voice"], default: "text" },
        text: { type: String },                 // متن پیام (برای type = text)
        fileId: { type: String },               // file_id تلگرام برای عکس یا ویس
        timestamp: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default models.Message || model("Message", messageSchema);
