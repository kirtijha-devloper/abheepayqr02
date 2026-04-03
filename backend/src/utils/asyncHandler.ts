import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async route handler to automatically catch errors and pass them
 * to the global Express error handling middleware.
 * This completely eliminates the need for try/catch blocks in every route/controller.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * An asyncHandler mapped specifically for AuthRequest which includes the userId
 */
export const asyncAuthHandler = (
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
