-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL DEFAULT 'https://api.dicebear.com/10.x/micah/svg?seed=Alex&backgroundColor=7E57C2',
    "appLanguage" TEXT NOT NULL DEFAULT 'en',
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "director" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "genres" TEXT[],
    "awardTag" TEXT,
    "directorsNote" TEXT NOT NULL,
    "curatorsTake" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "backdropUrl" TEXT NOT NULL,
    "videoStreamUrl" TEXT NOT NULL,
    "isHeroFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "userId" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("userId","movieId")
);

-- CreateTable
CREATE TABLE "behind_the_lens" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "filmmakerName" TEXT NOT NULL,
    "cameraNote" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "clipUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behind_the_lens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "film_submissions" (
    "id" UUID NOT NULL,
    "filmTitle" TEXT NOT NULL,
    "directorName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "screenerLink" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "film_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "movies_slug_key" ON "movies"("slug");

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
