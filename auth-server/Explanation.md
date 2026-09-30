### **🚀 How SSO (Single Sign-On) Works Between frontend1 (3116) and frontend2 (3117) Using Common auth-server (3115)**

The **Single Sign-On (SSO) flow** ensures that once a user logs in on **frontend1**, they are also **automatically logged in** on **frontend2** without having to log in again.

---

### **✅ The Key Components**
1. **Auth Server (`localhost:3115`)**
   - Handles **Google Authentication** (`/auth/google`).
   - Issues **JWT Tokens** (Stored as `userToken` in cookies).
   - Provides **login status verification** (`/check-auth`).
   - Allows **logout** (`/logout`).

2. **Frontend1 (`localhost:3116`) and Frontend2 (`localhost:3117`)**
   - Both make **authentication requests to `auth-server (3115)`**.
   - Read `userToken` from **cookies** (Set by `auth-server`).
   - Both use the same **Google Login** mechanism.
   - Backend1 (`3118`) and Backend2 (`3119`) verify the user's token with `auth-server`.

---

## **🔄 Step-by-Step SSO Flow**

### **🔹 Step 1: User Logs in on frontend1 (3116)**
1. **User clicks Google Login on frontend1**.
2. Google returns an **ID Token**.
3. Frontend1 sends this **ID Token** to `auth-server (3115)`.
4. `auth-server`:
   - **Validates** the Google ID Token.
   - **Creates a JWT (`userToken`)**.
   - Stores `userToken` in a **`SameSite=None` cookie**.
   - Sets another cookie `user` with user info.
5. **Frontend1 updates UI** to show user details.

✅ **Now, the user is logged into frontend1, and `userToken` is stored in cookies for `localhost` (which includes frontend2 as well!).**

---

### **🔹 Step 2: User Opens frontend2 (3117)**
1. **Frontend2 loads and calls `auth-server (3115)/check-auth`.**
2. Browser automatically **sends the `userToken` cookie** with the request.
3. `auth-server (3115)`:
   - Reads the `userToken` from the request.
   - **Verifies** the token and returns user details (`email, name, picture`).
4. **Frontend2 updates UI automatically**, **showing the user is already logged in**.

✅ **Now, the user is logged into frontend2 without logging in again. SSO is working!**

---

### **🔹 Step 3: User Accesses Backend1 (3118) and Backend2 (3119)**
1. **Frontend1 & Frontend2 make requests to backend1 (3118) and backend2 (3119)**.
2. Browser automatically **sends `userToken` (JWT) from cookies** to backend1/backend2.
3. **Backend1 & Backend2 call `auth-server (3115)/verify-token`** to validate the token.
4. If valid, backend1/backend2 **process the request** and return secure data.

✅ **SSO is complete! The user can use both frontends and both backends seamlessly.**

---

## **📌 Key Points That Enable SSO**
✅ **Cookies are set for `localhost`** (Shared between frontend1 and frontend2).  
✅ **`SameSite=None; Secure` for cross-origin cookie sharing** (If using HTTPS).  
✅ **Both frontends call `auth-server (3115)/check-auth` on page load** to check login status.  
✅ **Backends call `auth-server (3115)/verify-token`** to validate the JWT.

---

## **🛠️ Example SSO Debugging**
### **✅ To Check If SSO Works**
1. Open **frontend1 (`localhost:3116`)**.
2. **Login** using Google.
3. Open **frontend2 (`localhost:3117`)** in a new tab.
4. **User should already be logged in.**
5. Open **DevTools → Application → Cookies**.
   - Check if `userToken` is stored under **localhost** (not 3116 or 3117 specifically).
6. Open **DevTools → Network → Fetch/XHR**.
   - Check if `check-auth` request is sent on page load and returns `{ logged_in: true }`.

### **🚨 If SSO is Not Working**
1. **Cookies Not Present?**  
   - Check if `SameSite=None; Secure` is used in `auth-server` (especially for HTTPS).  
   - Ensure `credentials: "include"` is set in `fetch()`.

2. **Frontend2 Still Asks for Login?**  
   - Check if `auth-server (3115)/check-auth` is actually being called.  
   - Open DevTools **Network → Fetch/XHR** and inspect the request.

3. **Backend1 (3118) Rejecting Requests?**  
   - Open DevTools → Application → Cookies → **Check if `userToken` exists.**  
   - Manually call `auth-server (3115)/verify-token` to confirm token is valid.


## **🎯 Summary**
- **User logs in once on frontend1 (3116).**
- **Auth-server (3115) sets a shared `userToken` cookie.**
- **Frontend2 (3117) automatically detects the session using `check-auth`.**
- **Backends (3118, 3119) verify tokens through `auth-server`.**
- **SSO works smoothly between frontends and backends! 🚀**

---



## **🔍 Understanding Cookies & Cross-Domain SSO Between frontend1 (3116) and frontend2 (3117)**  

To understand **how cookies allow SSO**, let's go deeper into:  
1. **Which cookies are used?**  
2. **Under which domain they are stored?**  
3. **How can cookies from frontend1 (3116) be accessed by frontend2 (3117)?**  
4. **The difference between `userToken` and `user` cookies**.  

---

## **1️⃣ Which Cookies Are Used in SSO?**
During authentication, `auth-server (3115)` sets **two cookies**:  

### **✅ `userToken` (JWT)**
- **Purpose**: Stores the **JWT token** issued by `auth-server`.  
- **Content**: Encoded JWT token containing user email, name, and expiration time.  
- **Storage**: **HttpOnly cookie** (Cannot be accessed via JavaScript).  
- **Access**: Sent automatically with **every request** to `auth-server (3115)` and backend servers (`3118`, `3119`).  
- **Domain**: **`localhost`** (Allows sharing across frontends).  
- **Example Value**:
  ```
  userToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```

### **✅ `user` (User Info)**
- **Purpose**: Stores **readable user details** (email, name, picture) for UI updates.  
- **Content**: JSON string with **user details**.  
- **Storage**: **Accessible by JavaScript (`document.cookie`)**.  
- **Access**: Used by frontends (`3116`, `3117`) to display user details **without making extra API calls**.  
- **Domain**: **`localhost`** (Shared across frontends).  
- **Example Value**:
  ```
  user={"email":"head.iie@vnrvjiet.in","name":"Innovation Head","picture":"https://lh3.googleusercontent.com/..."}
  ```

---

## **2️⃣ Under Which Domain Are These Cookies Stored?**
The cookies are set by `auth-server (3115)` with the **domain `localhost`**, not `localhost:3115`.  

🔍 **Stored Cookies in DevTools (`Application → Cookies → localhost`)**
| Name      | Domain    | Path | Secure | HttpOnly | SameSite |
|-----------|----------|------|--------|----------|----------|
| `userToken` | `localhost` | `/`  | ❌ (if HTTP) ✅ (if HTTPS) | ✅ | `None` |
| `user` | `localhost` | `/`  | ❌ | ❌ | `Lax` |

---

## **3️⃣ How Can Cookies from frontend1 (3116) Be Accessed by frontend2 (3117)?**
### **✅ Cross-Domain Cookie Sharing in localhost**
Since the cookies are set under **`localhost`**, they are **available to all subdomains & ports** running under `localhost`.

This means:
- **Frontend1 (3116)** and **Frontend2 (3117)** both **share the same cookies** (`userToken` & `user`).
- When **frontend2 loads**, it automatically gets the `userToken` cookie from `localhost`.
- **Both frontends send `userToken` in requests to backend1 (3118) and backend2 (3119).**

### **🔍 Why?**
- `auth-server (3115)` sets cookies with **`Domain=localhost; Path=/; SameSite=None`**.  
- Since **all frontends use `localhost`**, the browser allows **cross-port** access.  

🚀 **Example**:  
If a cookie is set as:
```http
Set-Cookie: userToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Domain=localhost; Path=/; SameSite=None; HttpOnly;
```
Then:
- **Frontend1 (3116) & Frontend2 (3117) share this cookie automatically**.
- **Any backend request (3118, 3119) automatically includes `userToken`.**

---

## **4️⃣ `userToken` vs. `user` Cookie: Content, Storage & Access**
| Feature     | `userToken` (JWT) | `user` (User Info) |
|-------------|------------------|------------------|
| **Purpose** | Authenticated Token for API calls | UI Data (Username, Email, Picture) |
| **Content** | Encoded JWT with user identity (email, iat, exp) | JSON object with user details |
| **Storage** | **HttpOnly cookie** (not accessible via JavaScript) | **Readable cookie** (accessible via `document.cookie`) |
| **Access** | Sent **automatically** with API requests | Used by frontend UI (JS reads it) |
| **Security** | Secure authentication | Just UI convenience |
| **Example Value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `{"email":"head.iie@vnrvjiet.in","name":"Innovation Head"}` |

✅ **`userToken` is used for secure authentication.**  
✅ **`user` is just for displaying user info in UI** (not for security).  

---

## **5️⃣ How `userToken` Enables SSO**
1. **User logs in on frontend1 (3116)** → `auth-server (3115)` **stores `userToken` & `user` for `localhost`**.
2. **User opens frontend2 (3117)** → `check-auth` request automatically sends `userToken` **without needing to log in again**.
3. **Frontend2 updates UI** based on the `user` cookie.
4. **All backend requests (`3118`, `3119`) also include `userToken`**, ensuring authentication.

---
---

## **🔹 Summary**
1. `auth-server (3115)` sets `userToken` and `user` cookies for `localhost`.
2. **Both frontend1 (3116) & frontend2 (3117) share these cookies**.
3. **Backends (3118, 3119) verify tokens via `auth-server (3115)`.**
4. **`userToken` is a secure authentication token** (HttpOnly, not accessible by JS).
5. **`user` is just for UI purposes** (JavaScript can read it).
6. **SSO Works Because:**
   - Cookies are stored for `localhost`, **not a specific port**.
   - Frontends read `userToken` on page load, allowing automatic login.

## **1️⃣ Will `userToken` Be Sent to `example.com/api/foobar`?**
No, **`userToken` will NOT be sent automatically** to `example.com/api/foobar` because:
1. **Cookies are domain-bound**:  
   - Your `userToken` cookie is set under `localhost`, not `example.com`.
   - Browsers **only send cookies to the same domain** they were set for.

2. **Cross-Origin Requests (CORS & Cookies)**:
   - Even if `example.com` allows CORS, the browser will **not send cookies** unless:
     - The cookie is set with `Domain=example.com`.
     - The frontend fetch request includes `credentials: "include"`.

3. **Solution if You Want to Send Cookies to `example.com`**:
   - Set `Domain=example.com` when setting cookies in `auth-server`.
   - Make sure `example.com` API supports CORS and allows credentials.

---

## **2️⃣ Which Cookie Should the Frontend Use to Render User Details?**
The frontend should use **`user`** for rendering user details **(not `userToken`)** because:

| Feature          | `userToken` (JWT)  | `user` (User Info) |
|------------------|------------------|------------------|
| **Purpose**      | Auth token (sent with requests) | UI display data |
| **Content**      | Encoded JWT (email, name, iat, exp) | Readable JSON (email, name, picture) |
| **Access**       | **HttpOnly** (JavaScript **CANNOT** access) | **Accessible** via `document.cookie` |
| **Storage**      | Secure, meant for authentication | Used for frontend UI updates |
| **Use Case**     | Sent with backend API requests for authentication | Used to display user name, profile picture on UI |

✅ **Frontend should read `user` for UI display (e.g., show name, email, profile pic).**  
✅ **Frontend should NOT use `userToken` directly (it's meant for API authentication).**

---

## **3️⃣ Why Did `user` and `userToken` Disappear When You Cleared `localhost:3117` Cookies?**
**🧐 Observations**:
1. `user` & `userToken` were stored in **localhost:3116**.
2. You cleared **cookies in localhost:3117**.
3. After refresh, all other cookies came back **except `user` and `userToken`**.
4. When you checked `localhost:3116`, **`user` & `userToken` were also removed.**

**🔍 Explanation:**
- Since `auth-server (3115)` originally set `userToken` and `user` cookies **with `Domain=localhost`**, the browser stored them **globally for `localhost`**, not for specific ports.
- When you **cleared cookies in localhost:3117**, it deleted **all localhost cookies**, including those for **localhost:3116**.
- This is because **localhost is treated as a single entity across different ports**.

---

## **4️⃣ Summary**
| **Question** | **Answer** |
|-------------|-----------|
| **Will `userToken` be sent to `example.com/api/foobar`?** | ❌ No, because cookies are bound to `localhost` and won’t be sent to a different domain. |
| **Which cookie should the frontend use to display user info?** | ✅ `user` (stores readable JSON), **not `userToken`** (which is a JWT for authentication). |
| **Why did clearing cookies in localhost:3117 remove `userToken` and `user` from localhost:3116?** | 🚨 Because `localhost` shares cookies across all ports (3116, 3117). Clearing cookies in **one** removes them for **all**. |
| **How to persist user login after clearing cookies?** | ✅ Store `user` in `localStorage` as a fallback. |

🚀 **Now, frontend1 and frontend2 should be able to share login seamlessly!** Let me know if you need any refinements! 🔥