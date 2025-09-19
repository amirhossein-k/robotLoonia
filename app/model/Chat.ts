// app/model/Chat.ts
import mongoose, { Schema, Document } from "mongoose";

interface IChat extends Document {
    users: number[]; // دو کاربر
    startedAt: Date;
    endedAt?: Date;
    messages: {
        from: number;
        to: number;
        text?: string;
        photo?: string;
        voice?: string;
        type: "text" | "photo" | "voice";
        createdAt: Date;
    }[];
}

const ChatSchema = new Schema<IChat>({
    users: { type: [Number], required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    messages: [
        {
            from: Number,
            to: Number,
            text: String,
            photo: String,
            voice: String,
            type: String,
            createdAt: { type: Date, default: Date.now },
        },
    ],
});

export default mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);
