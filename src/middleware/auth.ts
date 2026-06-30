import { Request, Response, NextFunction } from 'express';
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase-client.ts';

export interface DecodedUser {
  uid: string;
  email: string;
  name: string;
  role: string;
  sub: string;
  [key: string]: any;
}

export interface AuthRequest extends Request {
  user?: DecodedUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (token && token.startsWith('MockToken:')) {
    try {
      const parts = token.slice(10).split(':');
      const uid = parts[0] || 'mock-uid-default';
      const role = parts[1] || 'user';
      const name = decodeURIComponent(parts[2] || 'User');
      const email = decodeURIComponent(parts[3] || 'user@support.com');

      req.user = {
        uid,
        email,
        name,
        role,
        aud: '',
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: '',
        sub: uid
      };
      return next();
    } catch (decodeErr) {
      console.error('Error decoding custom MockToken:', decodeErr);
    }
  }

  // Verify using Supabase Auth JWT if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data: { user }, error: supabaseErr } = await supabase.auth.getUser(token);
      if (user && !supabaseErr) {
        req.user = {
          uid: user.id,
          email: user.email || '',
          name: user.user_metadata?.username || user.email?.split('@')[0] || 'User',
          role: user.user_metadata?.role || 'user',
          aud: 'supabase',
          auth_time: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          iss: 'supabase',
          sub: user.id
        };
        return next();
      } else {
        console.error('[Supabase Middleware] Session verification failed:', supabaseErr?.message || 'No user session');
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
    } catch (err) {
      console.error('[Supabase Middleware] Session verification failed with exception:', err);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token session' });
};
