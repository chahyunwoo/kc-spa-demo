# 구현 상세 문서

이 문서는 Keycloak SPA Demo 프로젝트의 상세 구현 내용을 설명합니다.

---

## 목차

1. [이 프로젝트를 만든 이유](#이-프로젝트를-만든-이유)
2. [JWT란 무엇인가](#jwt란-무엇인가)
3. [인증 플로우 전체 흐름](#인증-플로우-전체-흐름)
4. [Frontend (React) 구현](#frontend-react-구현)
5. [Backend (NestJS) 구현](#backend-nestjs-구현)
6. [Keycloak 역할](#keycloak-역할)

---

## 이 프로젝트를 만든 이유

### 학습 목표

현대 웹 애플리케이션에서 가장 널리 사용되는 인증 방식인 **OAuth 2.0 / OpenID Connect** 플로우를 직접 구현하며 학습하기 위해 만들었습니다.

### 배우고자 한 것들

1. **OAuth 2.0 Authorization Code Flow + PKCE**
   - SPA에서 안전하게 인증하는 표준 방식
   - Authorization Code가 탈취되어도 PKCE 덕분에 안전

2. **JWT 토큰 기반 인증**
   - Stateless 인증의 원리
   - 토큰 서명과 검증 방식

3. **Keycloak 사용법**
   - 엔터프라이즈급 오픈소스 인증 서버
   - Realm, Client, User 개념

4. **실제 프로덕션 패턴**
   - 토큰 자동 갱신
   - CORS 설정
   - 보안 Best Practice

---

## JWT란 무엇인가

### JWT (JSON Web Token) 정의

JWT는 당사자 간에 정보를 안전하게 전송하기 위한 **컴팩트하고 자가 수용적인(self-contained)** 방식입니다. 디지털 서명되어 있어 검증과 신뢰가 가능합니다.

### JWT 구조

JWT는 점(.)으로 구분된 세 부분으로 구성됩니다:

```
xxxxx.yyyyy.zzzzz
  │      │      │
  │      │      └── Signature (서명)
  │      └── Payload (내용)
  └── Header (헤더)
```

#### 1. Header (헤더)

토큰 유형과 서명 알고리즘을 지정합니다.

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id-here"
}
```

- **alg**: 서명 알고리즘 (RS256 = RSA + SHA-256)
- **typ**: 토큰 타입 (JWT)
- **kid**: Key ID (여러 키 중 어떤 키로 서명했는지)

#### 2. Payload (페이로드)

실제 전달하려는 데이터(Claims)를 담습니다.

```json
{
  "iss": "http://localhost:8080/realms/demo",
  "sub": "user-uuid-here",
  "exp": 1234567890,
  "iat": 1234567800,
  "preferred_username": "johndoe",
  "email": "john@example.com",
  "realm_access": {
    "roles": ["user", "admin"]
  }
}
```

주요 Claims:
- **iss** (Issuer): 토큰 발급자
- **sub** (Subject): 토큰 주체 (사용자 ID)
- **exp** (Expiration): 만료 시간
- **iat** (Issued At): 발급 시간

#### 3. Signature (서명)

토큰이 변조되지 않았음을 보장합니다.

```
RSASHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  privateKey
)
```

### RS256 vs HS256

| 구분 | HS256 | RS256 |
|------|-------|-------|
| 유형 | 대칭키 (Symmetric) | 비대칭키 (Asymmetric) |
| 키 | 하나의 비밀키 | 공개키 + 개인키 쌍 |
| 서명 | 비밀키로 서명 | 개인키로 서명 |
| 검증 | 같은 비밀키로 검증 | 공개키로 검증 |
| 보안 | 키 공유 필요 | 공개키만 공유하면 됨 |

**Keycloak은 RS256을 사용합니다.** API 서버는 Keycloak의 공개키만 알면 토큰을 검증할 수 있어서 더 안전합니다.

### JWT의 장점

1. **Stateless**: 서버에 세션 저장 불필요
2. **Self-contained**: 필요한 정보가 토큰에 포함
3. **확장성**: 마이크로서비스 환경에 적합
4. **표준화**: 다양한 언어/플랫폼에서 지원

### JWT의 주의점

1. **토큰 크기**: 쿠키보다 큼
2. **만료 전 무효화 어려움**: 별도 블랙리스트 필요
3. **민감 정보 주의**: Payload는 암호화되지 않음 (Base64 인코딩일 뿐)

---

## 인증 플로우 전체 흐름

### 1단계: 사용자가 로그인 버튼 클릭

```
┌─────────────┐
│  React SPA  │
│  :5173      │
└─────────────┘
      │
      │ 1. 사용자가 "Login" 버튼 클릭
      │
      │ 2. keycloak.login() 호출
      │
      ▼
```

React 앱에서 `keycloak.login()`을 호출하면 브라우저가 Keycloak 로그인 페이지로 리다이렉트됩니다.

### 2단계: Keycloak 로그인 페이지

```
      │
      │ 3. Keycloak 로그인 페이지로 리다이렉트
      │    URL에 PKCE code_challenge 포함
      │
      ▼
┌──────────────┐
│  Keycloak    │
│  :8080       │
└──────────────┘
      │
      │ 4. 사용자가 아이디/비밀번호 입력
      │
      │ 5. 인증 성공 시 Authorization Code 발급
      │
      ▼
```

### 3단계: 토큰 교환

```
      │
      │ 6. Authorization Code + PKCE code_verifier로
      │    Access Token 요청
      │
      ▼
┌──────────────┐
│  Keycloak    │
│  Token       │
│  Endpoint    │
└──────────────┘
      │
      │ 7. PKCE 검증 후 토큰 발급
      │    - Access Token (JWT)
      │    - Refresh Token
      │    - ID Token
      │
      ▼
┌─────────────┐
│  React SPA  │
│  토큰 저장   │
└─────────────┘
```

### 4단계: API 호출

```
┌─────────────┐                      ┌────────────────┐
│  React SPA  │                      │   NestJS API   │
│  :5173      │                      │   :3001        │
└─────────────┘                      └────────────────┘
      │                                     │
      │ 8. API 요청                         │
      │    Authorization: Bearer {token}   │
      │────────────────────────────────────>│
      │                                     │
      │                                     │ 9. JWT 검증
      │                                     │    - JWKS에서 공개키 조회
      │                                     │    - 서명 검증
      │                                     │    - issuer, exp 검증
      │                                     │
      │ 10. 응답 반환                       │
      │<────────────────────────────────────│
      │                                     │
```

### 5단계: 토큰 갱신

```
┌─────────────┐                      ┌──────────────┐
│  React SPA  │                      │  Keycloak    │
│  :5173      │                      │  :8080       │
└─────────────┘                      └──────────────┘
      │                                     │
      │ 11. 10초마다 토큰 만료 확인         │
      │     (만료 60초 전이면 갱신)         │
      │                                     │
      │ 12. Refresh Token으로              │
      │     새 Access Token 요청           │
      │────────────────────────────────────>│
      │                                     │
      │ 13. 새 토큰 발급                    │
      │<────────────────────────────────────│
      │                                     │
```

### PKCE란?

**PKCE (Proof Key for Code Exchange)**는 Authorization Code 탈취 공격을 방어합니다.

```
1. 클라이언트가 랜덤 문자열(code_verifier) 생성
2. code_verifier를 SHA256 해시 → code_challenge
3. 로그인 요청 시 code_challenge 전송
4. 토큰 요청 시 code_verifier 전송
5. 서버가 code_verifier를 해시해서 code_challenge와 비교
6. 일치하면 토큰 발급
```

공격자가 Authorization Code를 탈취해도 code_verifier를 모르면 토큰을 얻을 수 없습니다.

---

## Frontend (React) 구현

### 파일 구조

```
apps/web/src/
├── main.tsx          # 앱 진입점
├── App.tsx           # 메인 컴포넌트
├── auth/
│   └── keycloak.ts   # Keycloak 클라이언트 설정
└── .env.local        # 환경 변수
```

### Keycloak 클라이언트 설정

**`apps/web/src/auth/keycloak.ts`**

```typescript
import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KC_URL,       // Keycloak 서버 URL
  realm: import.meta.env.VITE_KC_REALM,   // Realm 이름
  clientId: import.meta.env.VITE_KC_CLIENT_ID, // Client ID
});
```

**역할:**
- Keycloak JavaScript 어댑터 인스턴스 생성
- 환경 변수에서 설정값 로드
- 이 인스턴스로 로그인/로그아웃/토큰 관리

### 메인 컴포넌트 상세

**`apps/web/src/App.tsx`**

#### 1. 상태 관리

```typescript
const [ready, setReady] = React.useState(false);        // 초기화 완료 여부
const [authenticated, setAuthenticated] = React.useState(false); // 로그인 상태
const [token, setToken] = React.useState<string | undefined>(undefined); // Access Token
const [me, setMe] = React.useState<any>(null);          // API 응답 데이터
const [meError, setMeError] = React.useState<string | null>(null); // API 에러
const [meLoading, setMeLoading] = React.useState(false); // API 로딩 상태
```

#### 2. Keycloak 초기화

```typescript
React.useEffect(() => {
  (async () => {
    const ok = await keycloak.init({
      onLoad: "check-sso",      // 기존 세션 확인 (자동 로그인 X)
      pkceMethod: "S256",       // PKCE 활성화 (SHA-256)
      checkLoginIframe: false,  // iframe 체크 비활성화 (성능)
    });

    setAuthenticated(ok);
    setToken(keycloak.token);
    setReady(true);

    // 토큰 자동 갱신 설정
    setInterval(async () => {
      if (!keycloak.authenticated) return;
      try {
        const refreshed = await keycloak.updateToken(60); // 60초 전 갱신
        if (refreshed) setToken(keycloak.token);
      } catch {
        // 갱신 실패 시 로그아웃 상태로
        setAuthenticated(false);
        setToken(undefined);
        setMe(null);
      }
    }, 10_000); // 10초마다 확인
  })();
}, []);
```

**초기화 옵션 설명:**
- `onLoad: "check-sso"`: 페이지 로드 시 기존 Keycloak 세션 확인
- `pkceMethod: "S256"`: PKCE 보안 활성화
- `checkLoginIframe: false`: 성능을 위해 비활성화

#### 3. API 호출

```typescript
async function callMe() {
  setMeError(null);
  setMe(null);

  // 로그인 안 됐으면 로그인 먼저
  if (!keycloak.authenticated || !keycloak.token) {
    await keycloak.login();
    return;
  }

  setMeLoading(true);
  try {
    // Bearer 토큰과 함께 API 호출
    const res = await fetch("http://localhost:3001/me", {
      headers: {
        Authorization: `Bearer ${keycloak.token}`,
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setMeError(`GET /me failed: ${res.status} ${JSON.stringify(data)}`);
      return;
    }

    setMe(data);
  } catch (e: any) {
    setMeError(e?.message ?? String(e));
  } finally {
    setMeLoading(false);
  }
}
```

**핵심 포인트:**
- `Authorization: Bearer {token}` 헤더로 JWT 전송
- 토큰 없으면 자동으로 로그인 페이지로 이동

#### 4. 로그인/로그아웃

```typescript
// 로그인
<button onClick={() => keycloak.login()}>Login</button>

// 로그아웃
<button onClick={() => keycloak.logout({
  redirectUri: window.location.origin
})}>
  Logout
</button>
```

---

## Backend (NestJS) 구현

### NestJS란?

NestJS는 Node.js 서버 프레임워크입니다. TypeScript 기반이며, Angular에서 영감을 받은 구조를 가집니다.

### 핵심 개념

1. **Module**: 관련 기능을 묶는 단위
2. **Controller**: HTTP 요청을 처리
3. **Service**: 비즈니스 로직 담당
4. **Guard**: 요청 전 인증/인가 검사
5. **Strategy**: Passport.js 인증 전략

### 파일 구조

```
apps/api/src/
├── main.ts              # 앱 진입점
├── app.module.ts        # 루트 모듈
├── app.controller.ts    # 메인 컨트롤러
├── app.service.ts       # 메인 서비스
└── auth/
    ├── auth.module.ts   # 인증 모듈
    ├── jwt.strategy.ts  # JWT 검증 전략
    └── jwt.guard.ts     # JWT 가드
```

### 진입점 (main.ts)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정: React 앱에서의 요청 허용
  app.enableCors({
    origin: 'http://localhost:5173',
  });

  await app.listen(3001);
}

bootstrap();
```

**역할:**
- NestJS 애플리케이션 생성
- CORS 활성화 (SPA에서 API 호출 가능하게)
- 포트 3001에서 서버 시작

### 루트 모듈 (app.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule],      // 인증 모듈 임포트
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**역할:**
- 애플리케이션의 루트 모듈
- AuthModule을 임포트하여 인증 기능 사용

### 컨트롤러 (app.controller.ts)

```typescript
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // 공개 엔드포인트 (인증 불필요)
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 보호된 엔드포인트 (JWT 필요)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return {
      sub: req.user.sub,
      preferred_username: req.user.preferred_username,
      email: req.user.email,
      roles: req.user.realm_access?.roles ?? [],
      raw: req.user,  // 전체 JWT payload
    };
  }
}
```

**역할:**
- `GET /`: 공개 엔드포인트
- `GET /me`: JWT 토큰 필요, 사용자 정보 반환
- `@UseGuards(JwtAuthGuard)`: 이 데코레이터가 JWT 검증을 수행

### JWT Strategy (jwt.strategy.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';

// Keycloak 설정
const KC_BASE = process.env.KC_BASE ?? 'http://localhost:8080';
const KC_REALM = process.env.KC_REALM ?? 'demo';
const ISSUER = `${KC_BASE}/realms/${KC_REALM}`;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // 1. Authorization 헤더에서 Bearer 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 2. 토큰 발급자 검증
      issuer: ISSUER,

      // 3. RS256 알고리즘만 허용
      algorithms: ['RS256'],

      // 4. JWKS에서 공개키 가져오기
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,                    // 키 캐싱
        rateLimit: true,                // 요청 제한
        jwksRequestsPerMinute: 10,      // 분당 10회
        jwksUri: `${ISSUER}/protocol/openid-connect/certs`,
      }),
    });
  }

  // 검증 성공 시 호출됨
  validate(payload: JwtPayload) {
    return payload;  // req.user에 저장됨
  }
}
```

**JWT 검증 과정:**

1. **토큰 추출**: `Authorization: Bearer xxx` 헤더에서 토큰 추출
2. **JWKS 조회**: Keycloak의 `/protocol/openid-connect/certs`에서 공개키 가져옴
3. **서명 검증**: RS256 알고리즘으로 서명 확인
4. **발급자 검증**: `iss` claim이 Keycloak URL과 일치하는지 확인
5. **만료 검증**: `exp` claim 확인 (자동)

### JWT Guard (jwt.guard.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**역할:**
- Passport의 `jwt` 전략을 사용하는 Guard
- 컨트롤러에서 `@UseGuards(JwtAuthGuard)`로 사용

### Auth Module (auth.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt.guard';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
```

**역할:**
- Passport 모듈 임포트
- JwtStrategy와 JwtAuthGuard 등록
- JwtAuthGuard를 다른 모듈에서 사용 가능하게 export

---

## Keycloak 역할

### Keycloak이란?

Keycloak은 **오픈소스 Identity and Access Management (IAM)** 솔루션입니다. Red Hat에서 개발하고 유지보수합니다.

### 주요 기능

1. **Single Sign-On (SSO)**: 한 번 로그인으로 여러 앱 사용
2. **Identity Brokering**: Google, GitHub 등 외부 로그인 연동
3. **User Federation**: LDAP, Active Directory 연동
4. **Standard Protocols**: OAuth 2.0, OpenID Connect, SAML 지원

### 핵심 개념

#### Realm (영역)

- 사용자, 클라이언트, 역할 등을 관리하는 **독립된 공간**
- 하나의 Keycloak에 여러 Realm 생성 가능
- 예: `demo` realm

#### Client (클라이언트)

- Keycloak에 인증을 요청하는 **애플리케이션**
- 예: `react-spa`
- Public Client: 비밀키 없음 (SPA에 적합)
- Confidential Client: 비밀키 있음 (백엔드에 적합)

#### User (사용자)

- 로그인할 수 있는 **계정**
- 사용자명, 이메일, 비밀번호 등

#### Role (역할)

- 사용자에게 부여하는 **권한**
- 예: `admin`, `user`

### Keycloak의 주요 엔드포인트

| 엔드포인트 | 용도 |
|-----------|------|
| `/realms/{realm}/.well-known/openid-configuration` | OpenID Connect 설정 정보 |
| `/realms/{realm}/protocol/openid-connect/auth` | 로그인 페이지 |
| `/realms/{realm}/protocol/openid-connect/token` | 토큰 발급 |
| `/realms/{realm}/protocol/openid-connect/certs` | JWKS (공개키) |
| `/realms/{realm}/protocol/openid-connect/logout` | 로그아웃 |
| `/realms/{realm}/protocol/openid-connect/userinfo` | 사용자 정보 |

### 이 프로젝트에서 Keycloak의 역할

1. **로그인 페이지 제공**: 사용자 인증 UI
2. **토큰 발급**: JWT Access Token, Refresh Token 발급
3. **토큰 검증 정보 제공**: JWKS 엔드포인트로 공개키 제공
4. **세션 관리**: SSO 세션 유지
5. **토큰 갱신**: Refresh Token으로 새 Access Token 발급

---

## 요약

이 프로젝트는 현대적인 SPA 인증의 **Best Practice**를 구현합니다:

1. **Authorization Code Flow + PKCE**: SPA에서 가장 안전한 인증 방식
2. **JWT (RS256)**: Stateless하고 검증 가능한 토큰
3. **자동 토큰 갱신**: 사용자 경험 향상
4. **CORS 설정**: 안전한 크로스 오리진 통신
5. **JWKS 검증**: 공개키로 토큰 서명 검증

이 패턴을 이해하면 실제 프로덕션 환경에서도 안전한 인증 시스템을 구축할 수 있습니다.
