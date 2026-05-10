import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import crypto from 'crypto';
import { Container } from 'typedi';
import { OAuthAccountRepository, OAUTH_ACCOUNT_REPOSITORY } from '../../../domain/oauth/OAuthAccountRepository';
import { UserRepository, USER_REPOSITORY } from '../../../domain/user/UserRepository';

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
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${tokenObj.token}`);
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

  router.post('/facebook/data-deletion', async (req: Request, res: Response) => {
    try {
      const signedRequest: string = req.body?.signed_request;
      if (!signedRequest) return res.status(400).json({ error: 'missing signed_request' });

      const [encodedSig, encodedPayload] = signedRequest.split('.');
      if (!encodedSig || !encodedPayload) return res.status(400).json({ error: 'invalid signed_request' });

      const secret = process.env.FACEBOOK_APP_SECRET;
      if (!secret) return res.status(500).json({ error: 'server misconfiguration' });

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const sigBuf = Buffer.from(encodedSig);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return res.status(403).json({ error: 'invalid signature' });
      }

      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      const facebookUserId: string = payload.user_id;

      const oauthRepo = Container.get<OAuthAccountRepository>(OAUTH_ACCOUNT_REPOSITORY);
      const userRepo = Container.get<UserRepository>(USER_REPOSITORY);

      const oauthAccount = await oauthRepo.findByProviderAndProviderId('facebook', facebookUserId);
      if (oauthAccount) {
        await userRepo.deleteById(oauthAccount.userId);
      }

      const confirmationCode = `fb-del-${facebookUserId}-${Date.now()}`;
      const statusUrl = `${process.env.API_URL}/api/v1/auth/facebook/deletion-status?id=${confirmationCode}`;

      return res.json({ url: statusUrl, confirmation_code: confirmationCode });
    } catch {
      return res.status(500).json({ error: 'server_error' });
    }
  });

  router.get('/facebook/deletion-status', (_req: Request, res: Response) => {
    res.json({ status: 'deleted' });
  });

  return router;
}
