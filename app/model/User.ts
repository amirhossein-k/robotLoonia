// app\model\User.ts
import mongoose from "mongoose";

const { Schema, model, models } = mongoose
const userSchema = new Schema(
    {
        telegramId: { type: Number, required: true, unique: true },
        username: String,
        firstName: String,
        lastName: String,
        step: { type: Number, default: 1 }, // تغییر به default = 1

        name: String,
        gender: { type: String, enum: ["male", "female"] },
        age: Number,
        province: String,
        city: String,

        // وضعیت انتظار برای آپلود عکس را در DB نگه می‌داریم
        awaitingPhotoSlot: { type: String, enum: ["slot1", "slot2", "slot3", null], default: null },

        photos: {
            slot1: { type: String, default: null },
            slot2: { type: String, default: null },
            slot3: { type: String, default: null },
        },
        likes: { type: [Number], default: [] }, // کاربرانی که این کاربر لایک کرده
        likedBy: { type: [Number], default: [] }, // کاربرانی که این کاربر را لایک کردند
        matches: { type: [Number], default: [] }, // کاربرانی که Match شده اند
        pendingRequests: { type: [Number], default: [] }, // درخواست‌هایی که کاربر باید قبول کند
        likesRemaining: { type: Number, default: 10 }, // تعداد لایک‌های باقی‌مانده
        isPremium: { type: Boolean, default: false },  // آیا کاربر عضویت ویژه دارد؟
        premiumUntil: { type: Date, default: null },   // تاریخ پایان عضویت ویژه

        bio: { type: String, default: "" },
        interests: { type: [String], default: [] },

        lookingFor: { type: String, default: "" },
    },
    { timestamps: true }
);

export default models.User || model("User", userSchema);
