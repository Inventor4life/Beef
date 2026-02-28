import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload, VerifyOptions } from "jsonwebtoken";

const _authJwtSecret: string = process.env.JWT_SECRET!; // sha256 of SuperSecretAuthKey
const options: VerifyOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithms: ['HS256']
}

// adapted from /experiments/multi_service_sign_in/src/presenter.ts
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token: string = req.cookies.user_token ?? "";
    if (token == "") {
        res.status(401).json({ error: "no token provided" });
        return;
    }
    try {
        const decoded = jwt.verify(token, _authJwtSecret, options);
        res.locals.user = decoded as JwtPayload;
        next();
    } catch (err) {
        console.log(`bad token: error ${err}`);
        res.status(401).json({ error: "invalid token" });
        return;
    }
}