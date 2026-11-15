# Aspectt OTT — Backend Server

A dedicated Node.js + Express backend service for the **Aspectt** independent cinema streaming platform powered by **PostgreSQL** and **Prisma ORM**.

---

## 📁 Architecture Overview

```text
Downloads/
├── OTT/                # React + Vite Frontend Client
└── OTT-backend/        # Node.js + Express Backend Server
    ├── prisma/
    │   ├── schema.prisma    # Prisma schema with 5 PostgreSQL models
    │   └── seed.js          # Database seeder (18 films, clips & demo user)
    ├── src/
    │   ├── index.js         # Express setup, middleware & health check
    │   ├── prisma.js        # Singleton PrismaClient instance
    │   └── routes/          # Modular REST API route handlers
    │       ├── index.js             # Route aggregator
    │       ├── movies.routes.js     # /api/movies & /api/movies/hero
    │       ├── behindTheLens.routes.js # /api/behind-the-lens
    │       └── submissions.routes.js   # /api/submissions
    ├── .env.example         # Environment template
    ├── .env                 # Local environment config
    ├── .gitignore           # Git ignore configuration
    ├── package.json         # Dependencies & scripts
    └── README.md            # Backend documentation
```

---

## 🗄️ Database Models (Prisma + PostgreSQL)

1. **User**: Account identity with UUID, email, password hash, avatar URL, app language, and subscription tier.
2. **Movie**: Feature films with slug, release year, duration, director, description, genres list, director's note, curator's take, 2:3 vertical poster, 16:9 horizontal backdrop, and video stream URL.
3. **Watchlist**: Composite primary key (userId + movieId) managing bookmarked films per user with cascade deletion.
4. **BehindTheLens**: Production stills and footage clips with camera notes, filmmaker name, duration, and clip URL.
5. **FilmSubmission**: Creator film submissions for curatorial review with screener link, synopsis, strict status tracking (`SubmissionStatus`: `PENDING`, `APPROVED`, `REJECTED`), review reason/feedback, and automated timestamps (`submittedAt`, `createdAt`, `updatedAt`).

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
cd OTT-backend
npm install
```

### 2. Configure Environment
Update the PostgreSQL connection string in `.env` if needed:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/aspectt_ott?schema=public"
JWT_SECRET="aspectt_dev_jwt_secret_change_in_production"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173,http://localhost:5174"
```

### 3. Generate Prisma Client, Run Migrations & Seed Database
```bash
# Generate the Prisma Client
npx prisma generate

# Create and apply migrations to your PostgreSQL database
npx prisma migrate dev --name init

# Seed initial curated cinema catalog, behind-the-lens clips, and demo user
npx prisma db seed
# or: npm run prisma:seed
```

### 4. Start the Server
```bash
# Development mode (auto-reload on save)
npm run dev

# Production start
npm start
```

### 5. Health Check & API Reference
Verify the API is running by visiting:
* **GET http://localhost:5000/api/health**

#### Available REST Endpoints:
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and endpoint directory |
| `GET` | `/api/health` | Service uptime and health diagnostics |
| `GET` | `/api/movies` | All curated movies (supports `?search=`, `?genre=`, `?year=`) |
| `GET` | `/api/movies/hero` | Top 4 featured films for the hero deck (`isHeroFeatured: true`) |
| `GET` | `/api/movies/:id` | Full movie details by UUID or slug (returns `404` if not found) |
| `GET` | `/api/behind-the-lens` | Independent behind-the-scenes clips |
| `GET` | `/api/submissions` | List all film submissions (optional `?status=PENDING\|APPROVED\|REJECTED`) |
| `POST` | `/api/submissions` | Submit independent film screener for curatorial review (defaults to `PENDING`) |
| `PATCH`| `/api/submissions/:id` | Update submission status (`PENDING`, `APPROVED`, `REJECTED`) and review reason |
| `DELETE`| `/api/submissions/:id` | Remove a film submission record |
