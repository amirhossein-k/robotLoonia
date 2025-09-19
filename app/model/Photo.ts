// models/Photo.ts
import mongoose, { Schema, model, models } from "mongoose";

const PhotoSchema = new Schema(
    {
        userId: { type: Number, required: true }, // id تلگرام کاربر
        username: { type: String },
        firstName: { type: String },
        lastName: { type: String },

        fileUrl: { type: String, required: true }, // لینک فایل در پارس‌پک
        fileKey: { type: String, required: true }, // کلید فایل برای حذف
        telegramFileId: { type: String }, // id فایل تلگرام
    },
    { timestamps: true }
);

export default models.Photo || model("Photo", PhotoSchema);
