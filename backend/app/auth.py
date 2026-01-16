import os
from typing import Optional
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx

KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://keycloak:8080/auth")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "forensics")
KEYCLOAK_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "forensics-api")

security = HTTPBearer(auto_error=False)

_jwks_cache = None


async def get_keycloak_public_keys():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    
    jwks_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(jwks_url, timeout=10)
            if response.status_code == 200:
                _jwks_cache = response.json()
                return _jwks_cache
        except Exception as e:
            print(f"Failed to fetch JWKS: {e}")
    return None


def get_public_key_from_jwks(jwks: dict, kid: str):
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def decode_token(token: str) -> Optional[dict]:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        jwks = await get_keycloak_public_keys()
        if not jwks:
            return None
        
        key = get_public_key_from_jwks(jwks, kid)
        if not key:
            return None
        
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=KEYCLOAK_CLIENT_ID,
            options={"verify_aud": False}
        )
        return payload
    except JWTError as e:
        print(f"JWT decode error: {e}")
        return None


class CurrentUser:
    def __init__(self, payload: dict):
        self.id = payload.get("sub")
        self.email = payload.get("email")
        self.name = payload.get("name") or payload.get("preferred_username")
        self.roles = payload.get("realm_access", {}).get("roles", [])
        self.groups = payload.get("groups", [])
    
    def has_role(self, role: str) -> bool:
        return role in self.roles
    
    def is_admin(self) -> bool:
        return "admin" in self.roles or "forensic-admin" in self.roles
    
    def is_analyst(self) -> bool:
        return "analyst" in self.roles or "forensic-analyst" in self.roles or self.is_admin()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CurrentUser]:
    if not credentials:
        return None
    
    payload = await decode_token(credentials.credentials)
    if not payload:
        return None
    
    return CurrentUser(payload)


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = await decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return CurrentUser(payload)


async def require_admin(user: CurrentUser = Depends(require_auth)) -> CurrentUser:
    if not user.is_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


async def require_analyst(user: CurrentUser = Depends(require_auth)) -> CurrentUser:
    if not user.is_analyst():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst access required"
        )
    return user


def clear_jwks_cache():
    global _jwks_cache
    _jwks_cache = None
