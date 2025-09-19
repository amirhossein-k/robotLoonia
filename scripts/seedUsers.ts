// scripts/seedUsers.mts
import mongoose from "mongoose";
import User from "../app/model/User.js"; // .js مهمه وقتی type: module
import 'dotenv/config';

async function seed() {
    // اتصال به MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);

    // حذف همه کاربران قبلی (برای جلوگیری از duplicate key)
    await User.deleteMany({});

    const fakeUsers = [
        {
            telegramId: 2001,
            username: "sara_test",
            name: "سارا",
            gender: "زن",
            age: 22,
            province: "اصفهان",
            city: "اصفهان",
            bio: "من سارا هستم، برای تست.",
            interests: ["کتاب", "فیلم"],
            lookingFor: "دوستی جدید",
        },
        {
            telegramId: 2002,
            username: "mohammad_test",
            name: "محمد",
            gender: "مرد",
            age: 30,
            province: "شیراز",
            city: "شیراز",
            bio: "این پروفایل هم تستیه.",
            interests: ["ورزش", "تکنولوژی"],
            lookingFor: "ارتباط جدی",
        },
    ];

    await User.insertMany(fakeUsers);
    console.log("✅ پروفایل‌های تستی ساخته شد!");

    process.exit();
}

seed();
