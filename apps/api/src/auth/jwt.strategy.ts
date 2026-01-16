import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtFromRequestFunction } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';

const KC_BASE = process.env.KC_BASE ?? 'http://localhost:8080';
const KC_REALM = process.env.KC_REALM ?? 'demo';
const ISSUER = `${KC_BASE}/realms/${KC_REALM}`;

type JwtPayload = {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  [key: string]: unknown;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest,
      issuer: ISSUER,
      algorithms: ['RS256'],
      // jwks-rsa 타입이 passport-jwt가 기대하는 타입과 살짝 달라서 캐스팅해주는게 흔함
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${ISSUER}/protocol/openid-connect/certs`,
      }) as any,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
