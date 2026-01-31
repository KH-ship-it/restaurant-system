# backend/middleware/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt  # Đổi từ jose sang jwt
from datetime import datetime, timedelta
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv()

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT Settings -  PHẢI DÙNG ĐÚNG SECRET_KEY GIỐNG routes/auth.py
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

# Debug print
print(f" [middleware/auth.py] SECRET_KEY: {SECRET_KEY[:20]}...")

def verify_token(token: str = Depends(oauth2_scheme)):
    """Verify JWT token and return user data"""
    try:
        print(f"\n [verify_token] Verifying token...")
        print(f"   Token preview: {token[:30]}...")
        print(f"   Using SECRET_KEY: {SECRET_KEY[:20]}...")
        
        # Dùng jwt.decode thay vì jose.jwt.decode
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        print(f"Token verified successfully!")
        print(f"   User ID: {payload.get('user_id')}")
        print(f"   Username: {payload.get('username')}")
        print(f"   Role: {payload.get('role')}")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        print(f"Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        print(f" Invalid token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token không hợp lệ: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(allowed_roles: List[str]):
    """Check if user has required role"""
    def role_checker(current_user: dict = Depends(verify_token)):
        user_role = current_user.get("role")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không có quyền truy cập. Cần quyền: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_checker

def get_current_user_with_role(required_roles: List[str]):
    """Get current user and verify role"""
    def role_verifier(current_user: dict = Depends(verify_token)):
        user_role = current_user.get("role")
        
        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không có quyền truy cập. Cần quyền: {', '.join(required_roles)}"
            )
        
        return current_user
    
    return role_verifier