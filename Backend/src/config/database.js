import mongoose from "mongoose";

function shouldTryFallback(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toUpperCase();
    return (
        message.includes("querysrv econnrefused") ||
        message.includes("enotfound") ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND"
    );
}

function getFallbackUri() {
    if (process.env.MONGODB_URI_FALLBACK && process.env.MONGODB_URI_FALLBACK.trim()) {
        return process.env.MONGODB_URI_FALLBACK.trim();
    }

    if (process.env.NODE_ENV !== "production") {
        return "mongodb://127.0.0.1:27017/linkora";
    }

    return "";
}

const connectDB = async (mongoUri) => {
    try {
    if (!mongoUri) {
        throw new Error("Missing MongoDB connection string. Set MONGODB_URI");
    }

    await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected Successfully`);
    } catch (error) {
        const fallbackUri = getFallbackUri();

        if (fallbackUri && fallbackUri !== mongoUri && shouldTryFallback(error)) {
            try {
                console.warn(`Primary MongoDB connection failed (${error.message}). Trying fallback URI...`);
                await mongoose.connect(fallbackUri);
                console.log("MongoDB Connected Successfully (fallback)");
                return;
            } catch (fallbackError) {
                console.error(`Error: ${fallbackError.message}`);
                process.exit(1);
            }
        }

        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};
    

export default connectDB;