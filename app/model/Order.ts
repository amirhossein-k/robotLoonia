// app/model/Order.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
    productId: string;
    userId: string;
    status: "pending" | "approved" | "rejected";
    paymentReceipt: string; // لینک عکس رسید
    createdAt: Date;
}

const OrderSchema: Schema = new Schema({
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    paymentReceipt: String,
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Order ||
    mongoose.model<IOrder>("Order", OrderSchema);
