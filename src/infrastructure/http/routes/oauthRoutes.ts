import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function oauthCallback(provider: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(provider, { session: false }, (err: Error | null, tokenObj: { token: string } | false, info: any) => {
      if (err) {
        return res.redirect(`${process.env.CLIENT_URL}/auth?error=server_error`);
      }
      if (!tokenObj) {
        const ALLOWED_CODES = new Set(['oauth_email_missing', 'oauth_failed']);
        const code = ALLOWED_CODES.has(info?.message) ? info.message : 'oauth_failed';
        return res.redirect(`${process.env.CLIENT_URL}/auth?error=${encodeURIComponent(code)}`);
      }
      res.cookie('token', tokenObj.token, COOKIE_OPTIONS);
      res.redirect(`${process.env.CLIENT_URL}/`);
    })(req, res, next);
  };
}

export function oauthRoutes(): Router {
  const router = Router();

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback', oauthCallback('google'));

  router.get('/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'], session: false }));
  router.get('/facebook/callback', oauthCallback('facebook'));

  router.get('/apple', passport.authenticate('apple', { session: false }));
  router.post('/apple/callback', oauthCallback('apple'));

  return router;
}
