# WhistleDrop — Speak Without Being Seen 🔒

> **GDG on Campus SRM Recruitment 2026–27 | Technical Domain — Backend Task 1**

WhistleDrop is a secure, confidential reporting backend API designed for organizations where individuals need to submit sensitive reports without revealing their identity or creating an account. Reporters receive a cryptographically generated, unguessable case code to track updates asynchronously, while authorized moderators review, filter, and manage case statuses.

---

## 🚀 Key Features

* **100% Anonymous Submissions:** No user account, registration, IP address, user-agent, or identifying metadata is recorded or stored.
* **Cryptographically Secure Case Codes:** High-entropy random case codes (e.g. `WD-8K3P-9X2M`) that prevent enumeration or brute-force guessing.
* **Anonymous Case Tracking:** Reporters track investigation status and timeline notes using only their case code.
* **State Machine Status Workflow:** `SUBMITTED` → `UNDER_REVIEW` → `RESOLVED` / `DISMISSED`.
* **Moderator Portal API:** Role-based access control with JWT authentication to review, filter by category/status, append status updates, and permanently close cases.
* **Interactive OpenAPI/Swagger Documentation:** Fully interactive API playground available at `/api-docs`.
* **Zero-Config Database:** Uses SQLite with Prisma ORM for seamless out-of-the-box local testing.
* **Comprehensive Test Suite:** Includes unit and integration tests powered by Vitest & Supertest.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Language & Runtime** | Node.js (v20+) with TypeScript |
| **Framework** | Express.js |
| **Database & ORM** | SQLite + Prisma ORM |
| **Authentication** | JSON Web Tokens (JWT) + Bcrypt |
| **Validation** | Zod |
| **Documentation** | OpenAPI 3.0 / Swagger UI (`swagger-ui-express`) |
| **Testing** | Vitest + Supertest |
| **Containerization** | Docker & Docker Compose |

---

## 🔐 How Anonymity & Privacy Are Maintained

1. **Zero Logging of PII:** The server explicitly excludes storing or processing IP addresses, HTTP request headers (like `User-Agent`), or geographic locations.
2. **Account-Free Architecture:** Report creation does not require email, username, phone number, or authentication.
3. **Unhashable Case Codes:** Case codes act as single-use capability tokens generated with Node's `crypto` secure random bytes. Only someone possessing the exact case code can query the status of a report.
4. **Moderator Isolation:** The database schema has no fields or tables that connect reports to any user records or network sessions. Even if a moderator or database admin inspects raw tables, reporter identity cannot be reconstructed.

---

## 📥 Installation & Setup

### Option 1: Local Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/whistledrop-backend.git
   cd whistledrop-backend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Initialize Database & Seed Initial Moderator:**
   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:3000`.  
   Interactive API docs: `http://localhost:3000/api-docs`

5. **Run Automated Tests:**
   ```bash
   npm test
   ```

---

### Option 2: Docker Setup

```bash
docker-compose up --build
```

---

## 📡 API Endpoint Reference

### Public / Reporter Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/reports` | Submit an anonymous report | None |
| `GET` | `/api/v1/reports/track/:caseCode` | Check report status and timeline | None |

### Moderator Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/moderators/login` | Authenticate moderator & get JWT | None |
| `GET` | `/api/v1/moderators/reports` | List reports (Filter: `category`, `status`) | Bearer JWT |
| `GET` | `/api/v1/moderators/reports/:id` | View full report details | Bearer JWT |
| `PATCH` | `/api/v1/moderators/reports/:id/status` | Update report status & append update note | Bearer JWT |
| `POST` | `/api/v1/moderators/reports/:id/close` | Permanently close/archive case | Bearer JWT |

---

## 💡 Example Requests & Responses

### 1. Submit Anonymous Report
**`POST /api/v1/reports`**
```json
{
  "category": "Security",
  "description": "Unauthorized API credentials exposed in public configuration repo.",
  "evidenceUrl": "https://example.com/evidence/logs.png"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Report submitted successfully. Please store your case code safely to track progress anonymously.",
  "data": {
    "caseCode": "WD-7X9K-2M4P",
    "category": "Security",
    "status": "SUBMITTED",
    "createdAt": "2026-09-23T23:40:00.000Z"
  }
}
```

---

### 2. Track Report Status
**`GET /api/v1/reports/track/WD-7X9K-2M4P`**

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "caseCode": "WD-7X9K-2M4P",
    "category": "Security",
    "status": "UNDER_REVIEW",
    "isClosed": false,
    "createdAt": "2026-09-23T23:40:00.000Z",
    "updatedAt": "2026-09-23T23:42:00.000Z",
    "statusUpdates": [
      {
        "newStatus": "SUBMITTED",
        "note": "Report successfully submitted anonymously to WhistleDrop system.",
        "createdAt": "2026-09-23T23:40:00.000Z"
      },
      {
        "newStatus": "UNDER_REVIEW",
        "note": "Escalated to internal security auditor.",
        "createdAt": "2026-09-23T23:42:00.000Z"
      }
    ]
  }
}
```

---

### 3. Moderator Login
**`POST /api/v1/moderators/login`**
```json
{
  "username": "admin",
  "password": "adminpassword123"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Moderator authenticated successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "admin",
    "role": "MODERATOR"
  }
}
```

---

## 🏛️ Key Design Assumptions

1. **Category Constraints:** Allowed categories are restricted to `Security`, `Harassment`, `Corruption`, `Technical`, and `Other`.
2. **Case Code Loss:** If a reporter loses their case code, it cannot be recovered (by design) to preserve anonymity and security.
3. **Moderator Seeding:** Default moderator account credentials (`admin` / `adminpassword123`) can be overridden via `.env`.
