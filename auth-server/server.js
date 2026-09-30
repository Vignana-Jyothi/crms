require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            "http://localhost:3000", 
            "http://localhost:4000", 
            "http://localhost:6000", 
            "http://localhost:3117",
            "http://localhost:3112",

            "http://localhost:3203",
            "https://dev-auth.vjstartup.com",
            "https://auth.vjstartup.com",
            "https://dev-bus.vjstartup.com",
            "https://dev-wall.vjstartup.com",
	        "https://outpass.vjstartup.com",
            /^(http?:\/\/)?(localhost|127\.0\.0\.1):(3[0-2][0-9]{2})$/,
            /^https?:\/\/([a-zA-Z0-9-]+\.)?vjstartup\.com/
        ];

        // Check if the origin matches any of the allowed origins
        const isAllowed = allowedOrigins.some((allowedOrigin) => {
            if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin); // Check with regex for subdomains
            }
            return origin === allowedOrigin;
        });

        

        if (isAllowed || !origin) {
            callback(null, true); // ✅ Allow the request
        } else {
            callback(new Error('Not allowed by CORS'), false); // ❌ Reject the request
        }
    },
    credentials: true   // ✅ Allow cross-origin cookies
}));
app.options("*", cors());
app.use(cookieParser());

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ✅ Load public apps from environment variable
// Format in .env: PUBLIC_APPS=wall,events,marketplace
const PUBLIC_APPS = process.env.PUBLIC_APPS 
    ? process.env.PUBLIC_APPS.split(',').map(app => app.trim())
    : [];

console.log("🔧 Configured Public Apps:", PUBLIC_APPS);

// -----------------------------
// Helper utilities (DRY helpers)
// -----------------------------

// Try to parse app name (subdomain) from a URL like https://passport.vjstartup.com
function parseAppFromUrl(maybeUrl) {
    if (!maybeUrl) return undefined;
    try {
        const u = new URL(maybeUrl);
        const host = u.hostname; // e.g., passport.vjstartup.com
        const parts = host.split('.');
        if (parts.length >= 3 && parts.slice(-2).join('.') === 'vjstartup.com') {
            return parts[0]; // take the first label as app name
        }
        return undefined;
    } catch {
        return undefined;
    }
}

// Get app name from body, query, header, or infer from Origin/Referer
function getAppFromRequest(req) {
    const direct = (req.body && req.body.app) || (req.query && req.query.app) || req.headers['x-app-name'];
    if (direct) return direct;
    console.log("🔍 Inferring app from Origin/Referer headers", { origin: req.headers.origin, referer: req.headers.referer || req.headers.referrer });
    const origin = req.headers.origin;
    const referer = req.headers.referer || req.headers.referrer;
    const fromOrigin = parseAppFromUrl(origin);
    const fromReferer = parseAppFromUrl(referer);

    // Prefer Origin, then Referer
    return fromOrigin || fromReferer;
}

function isPublicAppName(app) {
    return PUBLIC_APPS.includes(app);
}

function isInternalEmail(email) {
    return typeof email === 'string' && email.toLowerCase().endsWith('@vnrvjiet.in');
}

// Centralized access decision for an app and email
function checkAccess(email, app) {
    const publicApp = isPublicAppName(app);
    
    const allowedExternalEmails = process.env.ALLOWED_EXTERNAL_EMAILS 
        ? process.env.ALLOWED_EXTERNAL_EMAILS.split(',').map(e => e.trim().toLowerCase()) 
        : [];
    const isAllowedExternal = typeof email === 'string' && allowedExternalEmails.includes(email.toLowerCase());

    const internal = isInternalEmail(email) || isAllowedExternal;
    return {
        publicApp,
        internal,
        allowed: publicApp || internal,
        reason: publicApp ? undefined : 'Only @vnrvjiet.in email addresses or authorized external emails are allowed for this application'
    };
}

// Compute cookie settings once based on host
function getCookieSettings(req) {
    // Robust localhost detection (covers IPv4, IPv6, and port variations)
    const host = req.hostname || req.headers.host || '';
    const isLocalhost =
        host === 'localhost' ||
        host.startsWith('localhost:') ||
        host.startsWith('127.') ||
        host === '::1' ||
        host.startsWith('::1:') ||
        /^\[::1\](?::\d+)?$/.test(host);

    // For localhost, do not set domain and do not use secure cookies
    // For production, set domain to .vjstartup.com and secure cookies
    const cookieDomain = isLocalhost ? undefined : '.vjstartup.com';
    const base = {
        domain: cookieDomain,
        path: '/',
        sameSite: 'Lax',
        secure: !isLocalhost
    };
    return { isLocalhost, cookieDomain, base };
}

function setAuthCookies(res, req, userToken, user) {
    const { base } = getCookieSettings(req);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    res.cookie('userToken', userToken, {
        ...base,
        httpOnly: true,
        maxAge
    });

    res.cookie('user', JSON.stringify(user), {
        ...base,
        maxAge
    });
}

function clearAuthCookies(res, req) {
    const { base } = getCookieSettings(req);
    res.cookie('userToken', '', {
        ...base,
        httpOnly: true,
        expires: new Date(0)
    });
    res.cookie('user', '', {
        ...base,
        expires: new Date(0)
    });
}

app.post("/auth/google", async (req, res) => {
    const { token } = req.body;
    const app = getAppFromRequest(req);
    console.log("🔍 Debug: Received Google Token =", token);
    console.log("🔍 Debug: App Name =", app, "Origin:", req.headers.origin, "Referer:", req.headers.referer || req.headers.referrer);

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        console.log("✅ Google Token Verified:", payload);

        const { email, name, picture, family_name } = payload;
        
        console.log("Email:", email);
console.log("HD:", payload.hd);

const access = checkAccess(email, app);
console.log("Access Result:", access);

        // ✅ Centralized access check
        const access = checkAccess(email, app);
        if (!access.allowed) {
            console.log("❌ Unauthorized domain for internal app:", email, "App:", app);
            return res.status(403).json({ 
                error: "Access Denied (Only VNRVJIET allowed)", 
                message: access.reason 
            });
        }

        console.log(`✅ Access granted for ${access.publicApp ? 'PUBLIC' : 'INTERNAL'} app:`, app);

        // ✅ Generate new JWT for internal authentication
        const userToken = jwt.sign(
            { email, name, picture, family_name },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );
                // ✅ Set cookies (centralized)
                setAuthCookies(res, req, userToken, { email, name, picture, family_name });
                console.log("✅ Cookies Set in Response Headers:", res.getHeaders()['set-cookie']);

        res.json({ token: userToken, user: { email, name, picture ,family_name} });

    } catch (error) {
        console.error("❌ Google Token Verification Failed:", error);
        res.status(401).json({ error: "Invalid Token" });
    }
});





app.get("/check-auth", (req, res) => {
    console.log("🔍 Debug: Received Check-auth");
    const token = req.cookies.userToken;
    const app = getAppFromRequest(req);

    console.log("🔍 Debug: App requesting auth check =", app);

    if (!token) {
        return res.json({ logged_in: false });
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);

        const access = checkAccess(user.email, app);
        if (!access.allowed) {
            console.log("❌ Access denied: External email trying to access internal app", {
                email: user.email,
                app,
                publicApp: access.publicApp
            });
            return res.json({ 
                logged_in: false, 
                error: "Access denied for this application" 
            });
        }

        console.log(`✅ Check-auth passed for ${access.publicApp ? 'PUBLIC' : 'INTERNAL'} app:`, app);
        res.json({ logged_in: true, user });
    } catch (error) {
        res.json({ logged_in: false });
    }
});



app.post("/verify-token", (req, res) => {
    const { token } = req.body; // ✅ Get token from request body
    const app = getAppFromRequest(req);
    console.log("🔍 Debug: Received Token for Verification =", token);
    console.log("🔍 Debug: App requesting verification =", app);

    if (!token) return res.status(401).json({ valid: false });

    try {
        // ✅ Verify the token using your secret
        const user = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ Token Verified:", user);

        const access = checkAccess(user.email, app);
        if (!access.allowed) {
            console.log("❌ Token valid but access denied for internal app", {
                email: user.email,
                app,
                publicApp: access.publicApp
            });
            return res.status(403).json({ 
                valid: false, 
                error: "Access denied for this application" 
            });
        }

        console.log(`✅ Token verification passed for ${access.publicApp ? 'PUBLIC' : 'INTERNAL'} app:`, app);
        res.json({ valid: true, user });
    } catch (error) {
        console.error("❌ Token Verification Failed:", error);
        res.status(403).json({ valid: false });
    }
});

app.post("/logout", (req, res) => {
    console.log("🔍 Debug: Logout");
    clearAuthCookies(res, req);
    res.json({ success: true });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        service: "auth-server-v2",
        timestamp: new Date().toISOString()
    });
});


// Start server only when executed directly, not when imported for tests
if (require.main === module) {
    app.listen(3115, () => console.log("Auth Server running on port 3115"));
}

module.exports = app;