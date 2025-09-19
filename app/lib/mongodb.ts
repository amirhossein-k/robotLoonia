// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
    throw new Error("❌ MONGODB_URI is not defined in .env");
}

let isConnected = false;

export async function connectDB() {
    if (isConnected) return;

    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: "telegram_bot", // اسم دیتابیس
        });
        isConnected = true;
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}
