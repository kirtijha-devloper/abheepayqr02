import { Request, Response, NextFunction } from "express";

/**
 * Global Error Handler Middleware
 * 
 * Catch all unhandled errors thrown inside routes/controllers that are wrapped
 * in asyncHandler. Formats the error securely before sending it to the client.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.message}`);

  // Don't send full stack trace in production (Vercel)
  const isProd = process.env.VERCEL || process.env.NODE_ENV === "production";

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    ...(isProd ? {} : { stack: err.stack }), // Attach stack trace only locally
  });
};
