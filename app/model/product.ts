


import mongoose, { Schema, Document } from "mongoose";


export interface IProduct extends Document {
    title: string;
    description: string;
    price: string;
    size: string;
    photoUrl: string;
}


const ProductSchema: Schema = new Schema(
    {
        title: { type: String, required: true },
        description: String,
        price: String,
        size: String,
        photoUrl: String,
    }
)

export default mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema)
