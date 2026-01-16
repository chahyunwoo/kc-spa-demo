# Keycloak SPA Demo

Keycloak을 이용한 SPA(Single Page Application) 인증 데모 프로젝트입니다.

## 프로젝트 개요

이 프로젝트는 **OAuth 2.0 / OpenID Connect** 인증 플로우를 학습하기 위해 만들어졌습니다. React SPA에서 Keycloak 인증 서버를 통해 로그인하고, NestJS API 서버에서 JWT 토큰을 검증하는 전체 흐름을 구현합니다.

### 학습 목표

- OAuth 2.0 Authorization Code Flow + PKCE 이해
- JWT(JSON Web Token) 구조와 검증 방식 이해
- Keycloak 인증 서버 설정 및 사용법
- SPA에서의 토큰 관리 및 자동 갱신
- NestJS에서 JWT 검증 구현

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| Backend | NestJS 11, Passport.js |
| Auth Server | Keycloak 26.0 (Docker) |
| Package Manager | pnpm (monorepo) |
| 인증 방식 | OAuth 2.0 + OpenID Connect |
| 토큰 | JWT (RS256) |

## 프로젝트 구조

```
kc-spa-demo/
├── apps/
│   ├── web/          # React SPA (포트 5173)
│   └── api/          # NestJS API (포트 3001)
├── infra/
│   └── keycloak/     # Keycloak Docker 설정
├── package.json
└── pnpm-workspace.yaml
```

## 실행 방법

### 1. 의존성 설치

```bash
pnpm install
```

### 2. Keycloak 시작

```bash
pnpm run kc:up
```

Keycloak이 `http://localhost:8080`에서 실행됩니다.

### 3. Keycloak 설정

1. `http://localhost:8080` 접속
2. 관리자 로그인: `admin` / `admin`
3. Realm 생성: `demo`
4. Client 생성: `react-spa`
   - Client type: OpenID Connect
   - Client authentication: Off (Public client)
   - Valid redirect URIs: `http://localhost:5173/*`
   - Web origins: `http://localhost:5173`
5. 사용자 생성 및 비밀번호 설정

### 4. API 서버 시작

```bash
pnpm run dev:api
```

### 5. 웹 앱 시작

```bash
pnpm run dev:web
```

### 6. 테스트

1. `http://localhost:5173` 접속
2. Login 버튼 클릭
3. Keycloak에서 로그인
4. Call /me 버튼으로 API 호출 테스트

## 환경 변수

### Web (apps/web/.env.local)

```
VITE_KC_URL=http://localhost:8080
VITE_KC_REALM=demo
VITE_KC_CLIENT_ID=react-spa
```

### API (apps/api)

```
KC_BASE=http://localhost:8080
KC_REALM=demo
```

## 주요 스크립트

```bash
pnpm run dev:web   # React 앱 개발 서버
pnpm run dev:api   # NestJS 개발 서버
pnpm run kc:up     # Keycloak 시작
pnpm run kc:down   # Keycloak 종료
```

## 참고 문서

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [keycloak-js](https://www.keycloak.org/docs/latest/securing_apps/#_javascript_adapter)

## 상세 구현 설명

자세한 구현 내용과 인증 플로우 설명은 [IMPLEMENT.md](./IMPLEMENT.md)를 참조하세요.
