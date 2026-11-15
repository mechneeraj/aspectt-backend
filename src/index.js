import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route modules
import moviesRouter from './routes/movies.routes.js';
import behindTheLensRouter from './routes/behindTheLens.routes.js';
import submissionsRouter from './routes/submissions.routes.js';
import userRouter from './routes/user.routes.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Aspectt OTT Backend API',
    docs: '/api/health',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      movies: 'GET /api/movies',
      heroMovies: 'GET /api/movies/hero',
      movieDetails: 'GET /api/movies/:id',
      behindTheLens: 'GET /api/behind-the-lens',
      submissions: 'GET, POST /api/submissions, PATCH /api/submissions/:id',
      user: 'GET, PATCH /api/user/profile, GET, POST /api/user/watchlist',
    },
  });
});

// Health check endpoint (Required: GET /api/health)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Aspectt OTT Backend API',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
  });
});

// Public & Protected REST API routes
app.use('/api/movies', moviesRouter);
app.use('/api/behind-the-lens', behindTheLensRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/user', userRouter);
app.use('/api/auth', userRouter);

// 404 handler for unrecognized routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});

// Start listening on configured port
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎬 Aspectt OTT Backend Server`);
  console.log(`🚀 Running at: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});

export default app;
export { server };

