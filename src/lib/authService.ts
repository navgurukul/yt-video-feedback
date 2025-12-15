/**
 * Auth Service Client
 * Handles communication with the Authentication Service
 */

const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3001';

export interface LoginResponse {
  success: boolean;
  data?: {
    user: {
      id: number;
      email: string;
      name: string;
      hasApiKey: boolean;
      createdAt: string;
      updatedAt: string;
    };
    token: string;
  };
  error?: string;
}

export interface ApiKeyResponse {
  success: boolean;
  data?: {
    success: boolean;
    user: any;
  };
  error?: string;
}

export interface VerifyTokenResponse {
  success: boolean;
  data?: {
    valid: boolean;
    user: any;
    payload: any;
  };
  error?: string;
}

/**
 * Login user and get JWT token
 */
export async function loginUser(email: string, name: string, supabaseId: string): Promise<LoginResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name, supabaseId }),
    });

    return await response.json();
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

/**
 * Set user's Gemini API key
 */
export async function setUserApiKey(email: string, apiKey: string): Promise<ApiKeyResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, apiKey }),
    });

    return await response.json();
  } catch (error) {
    console.error('API key set error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set API key',
    };
  }
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<VerifyTokenResponse> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token verification failed',
    };
  }
}

/**
 * Get auth token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('jwt_token');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('jwt_token', token);
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken(): void {
  localStorage.removeItem('jwt_token');
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
