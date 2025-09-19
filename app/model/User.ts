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
        // 🔥 فیلدهای آدرس جدید
        provinceText: String,
        cityText: String,
        postalAddress: String,
        postalCode: String,
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



        pendingRequests: { type: [Number], default: [] }, // درخواست‌هایی که کاربر باید قبول کند




        bio: { type: String, default: "" },
        interests: { type: [String], default: [] },

        lookingFor: { type: String, default: "" },
    },
    { timestamps: true }
);

export default models.User || model("User", userSchema);
