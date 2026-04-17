import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import {Router} from "express"
import jwt from "jsonwebtoken";
import type { JwtPayload, VerifyOptions } from "jsonwebtoken";

const options: VerifyOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithms: ['HS256']
}

export const requireAuth = Router()

// adapted from /experiments/multi_service_sign_in/src/presenter.ts
export function authCheck(req: Request, res: Response, next: NextFunction) {
    const token: string = req.cookies.user_token ?? "";
    if (token == "") {
        res.status(401).json({ error: "no token provided" });
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!, options);
        res.locals.user = decoded as JwtPayload;
        next();
    } catch (err) {
        console.log(`bad token: error ${err}`);
        res.status(401).json({ error: "invalid token" });
        return;
    }
}

// middleware factory - returns a function based on the provided scopes. Checks if the user has req scopes.
// ...scopes is a rest parameter, can take any number of scopes
export function requireScope(...scopes: string[]) {
    return function (req: Request, res: Response, next: NextFunction) {
        const tokenScopes = (res.locals.user?.scope ?? "").split(" ");
        const hasScope = scopes.some(s => tokenScopes.includes(s));
        if (!hasScope) {
            res.status(403).json({ error: "insufficient scope" });
            return;
        }
        next();
    };
}

requireAuth.use(cookieParser())
requireAuth.use(authCheck)
