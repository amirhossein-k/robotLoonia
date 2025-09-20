// app/model/Order.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: "pending" | "approved" | "payment_rejected" | "awaiting_payment" | "payment_review";
    paymentReceipt: string; // لینک عکس رسید
    createdAt: Date;
}

const OrderSchema: Schema = new Schema({
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    status: {
        type: String, enum: [
            "pending",          // کاربر سفارش داده
            "awaiting_payment", // تایید ادمین، منتظر پرداخت
            "payment_review",   // کاربر رسید فرستاده، منتظر تایید
            "approved",         // سفارش تایید شد
            "payment_rejected", // رسید رد شد
        ], default: "pending"
    },
    paymentReceipt: { type: String, default: "" },// file_id عکس رسید
    chatMode: { type: Boolean, default: false }, // گفتگو فعال است یا نه
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Order ||
    mongoose.model<IOrder>("Order", OrderSchema);
