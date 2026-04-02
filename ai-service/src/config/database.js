import mongoose from 'mongoose';
import env from './env.js';

export async function connectDatabase() {
    await mongoose.connect(env.mongodbUri);
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}
