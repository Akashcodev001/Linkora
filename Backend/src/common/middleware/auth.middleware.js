import jwt from "jsonwebtoken";
import { sendError } from "../helpers/response.js";

export function authUser(req,res,next){
    const token = req.cookies?.accessToken || req.cookies?.token;

    if(!token){
        return sendError(res, "Unauthorized", "No token provided", 401);
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch(err){
        return sendError(res, "Unauthorized", "Invalid or expired token", 401);
    }
}