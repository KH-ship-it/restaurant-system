from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime
import re
import uuid

router = APIRouter()


# ==================== SCHEMAS ====================

class BankAccountBase(BaseModel):
    """Base schema cho bank account"""
    bank_name: str
    bank_logo: Optional[str] = None
    account_number: str
    account_holder: str
    branch_name: Optional[str] = None
    notes: Optional[str] = None

    @validator('account_number')
    def validate_account_number(cls, v):
        """Validate account number: 6-20 digits"""
        clean_number = v.replace(' ', '').replace('-', '')
        if not re.match(r'^\d{6,20}$', clean_number):
            raise ValueError('Số tài khoản phải từ 6-20 chữ số')
        return clean_number

    @validator('account_holder')
    def validate_account_holder(cls, v):
        """Validate account holder name"""
        if len(v) < 2:
            raise ValueError('Tên chủ tài khoản phải có ít nhất 2 ký tự')
        if not re.match(r'^[a-zA-ZÀ-ỹ\s]+$', v):
            raise ValueError('Tên chủ tài khoản chỉ được chứa chữ cái')
        return v.strip().upper()


class BankAccountCreate(BankAccountBase):
    """Schema tạo bank account mới"""
    pass


class BankAccountUpdate(BaseModel):
    """Schema update bank account"""
    bank_name: Optional[str] = None
    bank_logo: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    branch_name: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class BankAccountResponse(BankAccountBase):
    """Schema response bank account"""
    id: str
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BankAccountToggle(BaseModel):
    """Schema toggle active status"""
    is_active: bool


# ==================== MOCK DATABASE ====================
# TODO: Replace với database thật khi deploy

mock_db_banks = [
    {
        "id": "1",
        "bank_name": "Vietcombank",
        "bank_logo": "VCB",
        "account_number": "1023445566",
        "account_holder": "NHA HANG PHUONG NAM",
        "branch_name": "Chi nhánh Hà Nội",
        "notes": "",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    },
    {
        "id": "2",
        "bank_name": "MB Bank",
        "bank_logo": "MB",
        "account_number": "99900011",
        "account_holder": "NHA HANG PHUONG NAM",
        "branch_name": "",
        "notes": "",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
]


# ==================== HELPER FUNCTIONS ====================

def find_account(account_id: str):
    """Tìm account theo ID"""
    for account in mock_db_banks:
        if account["id"] == account_id:
            return account
    return None


def check_duplicate(bank_name: str, account_number: str, exclude_id: str = None):
    """Kiểm tra trùng số tài khoản"""
    for account in mock_db_banks:
        if (account["bank_name"] == bank_name and 
            account["account_number"] == account_number and
            account["id"] != exclude_id):
            return True
    return False


# ==================== API ENDPOINTS ====================

@router.get("/bank-accounts", response_model=List[BankAccountResponse])
async def get_bank_accounts(
    search: Optional[str] = None,
    bank_name: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """
    Lấy danh sách tài khoản ngân hàng
    
    Query params:
    - search: Tìm kiếm theo bank_name, account_number, account_holder
    - bank_name: Lọc theo tên ngân hàng
    - is_active: Lọc theo trạng thái active
    """
    accounts = mock_db_banks.copy()
    
    # Apply search filter
    if search:
        search_lower = search.lower()
        accounts = [
            acc for acc in accounts
            if (search_lower in acc["bank_name"].lower() or
                search_lower in acc["account_number"].lower() or
                search_lower in acc["account_holder"].lower())
        ]
    
    # Apply bank_name filter
    if bank_name:
        accounts = [acc for acc in accounts if acc["bank_name"] == bank_name]
    
    # Apply is_active filter
    if is_active is not None:
        accounts = [acc for acc in accounts if acc["is_active"] == is_active]
    
    return accounts


@router.get("/bank-accounts/active", response_model=List[BankAccountResponse])
async def get_active_bank_accounts():
    """Lấy danh sách tài khoản đang active (hiển thị tại thu ngân)"""
    return [acc for acc in mock_db_banks if acc["is_active"]]


@router.get("/bank-accounts/stats")
async def get_bank_accounts_stats():
    """Thống kê tài khoản ngân hàng"""
    total = len(mock_db_banks)
    active = len([acc for acc in mock_db_banks if acc["is_active"]])
    
    # Count by bank
    banks = {}
    for acc in mock_db_banks:
        bank = acc["bank_name"]
        if bank not in banks:
            banks[bank] = {"total": 0, "active": 0}
        banks[bank]["total"] += 1
        if acc["is_active"]:
            banks[bank]["active"] += 1
    
    return {
        "total_accounts": total,
        "active_accounts": active,
        "locked_accounts": total - active,
        "accounts_by_bank": banks
    }


@router.get("/bank-accounts/{account_id}", response_model=BankAccountResponse)
async def get_bank_account(account_id: str):
    """Lấy chi tiết một tài khoản"""
    account = find_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản ngân hàng"
        )
    return account


@router.post("/bank-accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(account: BankAccountCreate):
    """Tạo tài khoản ngân hàng mới"""
    # Check duplicate
    if check_duplicate(account.bank_name, account.account_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số tài khoản đã tồn tại trong hệ thống"
        )
    
    # Create new account
    new_account = {
        "id": str(uuid.uuid4()),
        "bank_name": account.bank_name,
        "bank_logo": account.bank_logo or account.bank_name[:3].upper(),
        "account_number": account.account_number,
        "account_holder": account.account_holder.upper(),
        "branch_name": account.branch_name or "",
        "notes": account.notes or "",
        "status": "active",
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    mock_db_banks.append(new_account)
    return new_account


@router.put("/bank-accounts/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(account_id: str, account_update: BankAccountUpdate):
    """Cập nhật thông tin tài khoản"""
    account = find_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản ngân hàng"
        )
    
    # Update fields
    update_data = account_update.dict(exclude_unset=True)
    
    # Check duplicate if updating account number
    if "account_number" in update_data or "bank_name" in update_data:
        new_bank = update_data.get("bank_name", account["bank_name"])
        new_number = update_data.get("account_number", account["account_number"])
        if check_duplicate(new_bank, new_number, exclude_id=account_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tài khoản đã tồn tại trong hệ thống"
            )
    
    # Apply updates
    for field, value in update_data.items():
        if value is not None:
            if field == "account_holder":
                account[field] = value.upper()
            else:
                account[field] = value
    
    account["updated_at"] = datetime.now()
    return account


@router.patch("/bank-accounts/{account_id}/toggle", response_model=BankAccountResponse)
async def toggle_bank_account(account_id: str, toggle_data: BankAccountToggle):
    """Bật/tắt hiển thị tài khoản tại thu ngân"""
    account = find_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản ngân hàng"
        )
    
    account["is_active"] = toggle_data.is_active
    account["status"] = "active" if toggle_data.is_active else "locked"
    account["updated_at"] = datetime.now()
    
    return account


@router.delete("/bank-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(account_id: str):
    """Xóa tài khoản ngân hàng"""
    account = find_account(account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản ngân hàng"
        )
    
    mock_db_banks.remove(account)
    return None


@router.get("/bank-accounts/banks/supported")
async def get_supported_banks():
    """Danh sách ngân hàng được hỗ trợ"""
    return {
        "banks": [
            {"name": "Vietcombank", "code": "VCB", "logo": "VCB"},
            {"name": "MB Bank", "code": "MB", "logo": "MB"},
            {"name": "VietinBank", "code": "CTG", "logo": "CTG"},
            {"name": "BIDV", "code": "BIDV", "logo": "BIDV"},
            {"name": "Techcombank", "code": "TCB", "logo": "TCB"},
            {"name": "ACB", "code": "ACB", "logo": "ACB"},
            {"name": "Sacombank", "code": "STB", "logo": "STB"},
            {"name": "VPBank", "code": "VPB", "logo": "VPB"},
            {"name": "Agribank", "code": "AGR", "logo": "AGR"},
            {"name": "TPBank", "code": "TPB", "logo": "TPB"},
        ]
    }