import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, asyncAuthHandler } from "../utils/asyncHandler";
import { registerUser, loginUser, getMe, loginAsUser } from "../controllers/authController";

const router = Router();

// POST /api/auth/register
router.post("/register", asyncHandler(registerUser));

// POST /api/auth/login
router.post("/login", asyncHandler(loginUser));

// GET /api/auth/me — get own profile + role 
router.get("/me", requireAuth, asyncAuthHandler(getMe));

// POST /api/auth/login-as/:id — Admin login-as feature
router.post("/login-as/:id", requireAuth, asyncAuthHandler(loginAsUser));

export default router;
