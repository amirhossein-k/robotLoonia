// app/model/Chat.ts
import mongoose, { Schema, Document } from "mongoose";

interface IMessage {
    from: number;
    to: number;
    text?: string;
    photo?: string;
    voice?: string;
    type: "text" | "photo" | "voice";
    createdAt: Date;
}
interface IChat extends Document {
    users: number[];
    startedAt: Date;
    endedAt?: Date;
    messages: IMessage[];
}



const ChatSchema = new Schema<IChat>({
    users: { type: [Number], required: true, validate: [(val: number[]) => val.length === 2, 'چت باید دقیقاً 2 کاربر داشته باشد'] },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    messages: [
        {
            from: Number,
            to: Number,
            text: String,
            photo: String,
            voice: String,
            type: { type: String, enum: ["text", "photo", "voice"], required: true },
            createdAt: { type: Date, default: Date.now },
        },
    ],
});
export default mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);
