import 'dotenv/config';
import mongoose from 'mongoose';
import userModel from '../src/models/user.model.js';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@linkora.local';
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@12345';
const username = process.env.ADMIN_BOOTSTRAP_USERNAME || 'linkora_admin';

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    let user = await userModel.findOne({ email: String(email).trim().toLowerCase() });

    if (!user) {
        user = await userModel.create({
            username,
            email: String(email).trim().toLowerCase(),
            password,
            verified: true,
            role: 'admin',
            isSuspended: false,
            isDeleted: false,
        });
        console.log('Created admin user:', user.email);
    } else {
        user.role = 'admin';
        user.verified = true;
        user.isSuspended = false;
        user.suspensionReason = null;
        user.suspendedAt = null;
        if (password) {
            user.password = password;
        }
        await user.save();
        console.log('Updated existing user to admin:', user.email);
    }

    console.log('ADMIN_EMAIL=' + user.email);
    console.log('ADMIN_PASSWORD=' + password);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch {}
    process.exit(1);
});
