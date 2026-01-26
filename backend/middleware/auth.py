# backend/middleware/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
import os

# OAuth2 scheme - points to the token endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str = Depends(oauth2_scheme)):
    """Verify JWT token and return user data"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        user_id: int = payload.get("userId")
        
        if username is None or user_id is None:
            raise credentials_exception
            
        return payload
        
    except JWTError:
        raise credentials_exception

def require_role(allowed_roles: List[str]):
    """
    Dependency to check if user has required role
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(["ADMIN"]))])
        def admin_endpoint():
            return {"message": "Admin only"}
    """
    def role_checker(current_user: dict = Depends(verify_token)):
        user_role = current_user.get("role")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_checker

# Alternative: Direct role checker function
def get_current_user_with_role(required_roles: List[str]):
    """
    Get current user and verify they have one of the required roles
    
    Usage:
        @router.get("/admin-only")
        def admin_endpoint(user = Depends(get_current_user_with_role(["ADMIN"]))):
            return {"message": "Admin only", "user": user}
    """
    def role_verifier(current_user: dict = Depends(verify_token)):
        user_role = current_user.get("role")
        
        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(required_roles)}"
            )
        
        return current_user
    
    return role_verifier