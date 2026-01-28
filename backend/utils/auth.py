# ========================================
# FILE: backend/utils/auth.py - PHIÊN BẢN HOÀN CHỈNH
# ========================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os

# ========================================
# PASSWORD HASHING
# ========================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password
    
    Args:
        plain_password: Plain text password from user
        hashed_password: Hashed password from database
    
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"❌ Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """
    Hash a password for storing in database
    
    Args:
        password: Plain text password
    
    Returns:
        str: Hashed password
    """
    return pwd_context.hash(password)

# ========================================
# JWT TOKEN
# ========================================

# JWT Settings from environment or defaults
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

def create_access_token(user_id: int, username: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        user_id: User ID
        username: Username
        role: User role (OWNER, admin, CASHIER, etc.)
        expires_delta: Optional custom expiration time
    
    Returns:
        str: JWT token
    """
    # Prepare data to encode
    to_encode = {
        "user_id": user_id,
        "username": username,
        "role": role,
    }
    
    # Calculate expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add expiration to payload
    to_encode.update({"exp": expire})
    
    # Encode JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    print(f"🎟️ Created token for user_id={user_id}, expires at {expire}")
    
    return encoded_jwt

# ========================================
# TOKEN VERIFICATION
# ========================================

# HTTP Bearer scheme for extracting token from Authorization header
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verify JWT token from Authorization header and return user data
    
    Expected header format: Authorization: Bearer <token>
    
    Args:
        credentials: HTTPAuthorizationCredentials from FastAPI
    
    Returns:
        dict: User data (user_id, username, role)
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No authentication token found",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract user info
        user_id: int = payload.get("user_id")
        username: str = payload.get("username")
        role: str = payload.get("role")
        
        # Validate required fields
        if user_id is None or username is None:
            print(f"❌ Token missing required fields: user_id={user_id}, username={username}")
            raise credentials_exception
        
        # Check token expiration
        exp = payload.get("exp")
        if exp:
            current_time = datetime.utcnow().timestamp()
            if current_time > exp:
                print(f"❌ Token expired: exp={exp}, current={current_time}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        
        print(f"✅ Token verified for user: {username} (role: {role})")
        
        return {
            "user_id": user_id,
            "username": username,
            "role": role
        }
        
    except JWTError as e:
        print(f"❌ JWT decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"❌ Unexpected error in get_current_user: {str(e)}")
        raise credentials_exception

# ========================================
# OPTIONAL USER (for endpoints that work with or without auth)
# ========================================

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """
    Get current user if token is provided, otherwise return None
    Useful for endpoints that have different behavior for authenticated vs anonymous users
    
    Args:
        credentials: Optional HTTPAuthorizationCredentials
    
    Returns:
        dict or None: User data if authenticated, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None

# ========================================
# HELPER FUNCTIONS
# ========================================

def create_test_user_token(username: str = "test", role: str = "admin") -> str:
    """
    Create a test token for development/testing
    
    Args:
        username: Test username
        role: Test user role
    
    Returns:
        str: JWT token
    """
    return create_access_token(
        user_id=999,
        username=username,
        role=role,
        expires_delta=timedelta(hours=24)
    )

def decode_token_without_verification(token: str) -> dict:
    """
    Decode token without verifying signature (for debugging)
    
    Args:
        token: JWT token
    
    Returns:
        dict: Decoded payload
    """
    try:
        # Decode without verification (ONLY for debugging!)
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload
    except Exception as e:
        print(f"❌ Failed to decode token: {e}")
        return {}

# ========================================
# TESTING FUNCTIONS
# ========================================

if __name__ == "__main__":
    # Test password hashing
    print("\n" + "=" * 60)
    print("Testing Password Hashing")
    print("=" * 60)
    
    password = "password"
    hashed = get_password_hash(password)
    print(f"Plain password: {password}")
    print(f"Hashed: {hashed}")
    print(f"Verification: {verify_password(password, hashed)}")
    print(f"Wrong password: {verify_password('wrong', hashed)}")
    
    # Test token creation
    print("\n" + "=" * 60)
    print("Testing Token Creation")
    print("=" * 60)
    
    token = create_access_token(
        user_id=1,
        username="admin",
        role="admin"
    )
    print(f"Token: {token}")
    
    # Decode token
    payload = decode_token_without_verification(token)
    print(f"Decoded payload: {payload}")
    
    print("\n✅ All tests completed!")