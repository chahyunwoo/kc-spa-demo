"""
FastAPI JWT 인증 서버
- Keycloak에서 발급한 JWT 토큰을 검증
- NestJS API와 동일한 기능 제공
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import jwt, JWTError
from typing import Any
import os

# ============================================
# 설정
# ============================================

KC_BASE = os.getenv("KC_BASE", "http://localhost:8080")
KC_REALM = os.getenv("KC_REALM", "demo")
ISSUER = f"{KC_BASE}/realms/{KC_REALM}"
JWKS_URL = f"{ISSUER}/protocol/openid-connect/certs"

# ============================================
# FastAPI 앱 생성
# ============================================

app = FastAPI(
    title="Keycloak SPA Demo API (Python)",
    description="FastAPI로 구현한 JWT 인증 API",
    version="1.0.0",
)

# CORS 설정 - React 앱에서의 요청 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# JWT 인증
# ============================================

# Bearer 토큰 추출기
security = HTTPBearer()

# JWKS 캐시 (공개키를 매번 가져오지 않기 위해)
jwks_cache: dict[str, Any] | None = None


async def get_jwks() -> dict[str, Any]:
    """Keycloak JWKS 엔드포인트에서 공개키 가져오기"""
    global jwks_cache

    if jwks_cache is None:
        async with httpx.AsyncClient() as client:
            response = await client.get(JWKS_URL)
            response.raise_for_status()
            jwks_cache = response.json()

    return jwks_cache


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict[str, Any]:
    """
    JWT 토큰 검증

    1. Authorization 헤더에서 Bearer 토큰 추출
    2. JWT 헤더에서 kid(key id) 추출
    3. JWKS에서 해당 kid의 공개키 찾기
    4. 공개키로 서명 검증 + issuer 검증
    """
    token = credentials.credentials

    try:
        # JWKS 가져오기
        jwks = await get_jwks()

        # JWT 헤더에서 kid 추출 (검증 없이)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token header missing 'kid'",
            )

        # JWKS에서 해당 kid의 키 찾기
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break

        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Public key not found for kid: {kid}",
            )

        # 토큰 검증 (서명 + issuer + 만료시간)
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False},  # audience 검증 스킵 (Keycloak 설정에 따라)
        )

        return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch JWKS: {str(e)}",
        )


# ============================================
# 라우트
# ============================================


@app.get("/")
def root():
    """공개 엔드포인트 - 인증 불필요"""
    return {"message": "Hello from FastAPI!"}


@app.get("/me")
async def me(user: dict[str, Any] = Depends(verify_token)):
    """
    보호된 엔드포인트 - JWT 토큰 필요

    NestJS API의 /me 엔드포인트와 동일한 응답 형식
    """
    return {
        "sub": user.get("sub"),
        "preferred_username": user.get("preferred_username"),
        "email": user.get("email"),
        "roles": user.get("realm_access", {}).get("roles", []),
        "raw": user,
    }


# ============================================
# 앱 실행 (개발용)
# ============================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=3002, reload=True)
