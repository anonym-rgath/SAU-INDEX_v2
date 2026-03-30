from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

# Logging Setup (früh initialisieren für Sicherheitswarnungen)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Sichere JWT-Konfiguration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET or JWT_SECRET == 'change-this-secret-in-production':
    JWT_SECRET = secrets.token_hex(32)
    logger.warning("SECURITY: Kein JWT_SECRET konfiguriert - verwende zufälligen Schlüssel")
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 8  # Reduziert von 24 auf 8 Stunden für mehr Sicherheit

# Verstärktes Passwort-Hashing (bcrypt mit 12 Runden)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Standard ist 12, erhöht die Sicherheit
)
security = HTTPBearer()

# Brute-Force-Schutz Konfiguration
MAX_LOGIN_ATTEMPTS = 5  # Maximale Fehlversuche
LOCKOUT_DURATION_MINUTES = 15  # Sperrzeit in Minuten
LOGIN_ATTEMPT_WINDOW_MINUTES = 30  # Zeitfenster für Fehlversuche

# Passwort-Validierung
import re

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validiert Passwort nach aktuellen Sicherheitsrichtlinien.
    Mindestens 8 Zeichen, 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl.
    """
    if len(password) < 8:
        return False, "Passwort muss mindestens 8 Zeichen lang sein"
    if not re.search(r'[A-Z]', password):
        return False, "Passwort muss mindestens einen Großbuchstaben enthalten"
    if not re.search(r'[a-z]', password):
        return False, "Passwort muss mindestens einen Kleinbuchstaben enthalten"
    if not re.search(r'\d', password):
        return False, "Passwort muss mindestens eine Zahl enthalten"
    return True, ""

# Fiscal year configuration
FISCAL_YEAR_START_MONTH = 8  # August
FISCAL_YEAR_START_DAY = 1

def get_fiscal_year(date: datetime) -> str:
    """
    Berechnet das Geschäftsjahr für ein gegebenes Datum.
    Geschäftsjahr läuft vom 01.08.YYYY bis 31.07.(YYYY+1)
    
    Beispiel: 15.09.2025 -> "2025/2026"
              15.06.2026 -> "2025/2026"
              15.08.2026 -> "2026/2027"
    """
    year = date.year
    month = date.month
    day = date.day
    
    # Wenn vor dem Start des Geschäftsjahrs (vor 1. August)
    if month < FISCAL_YEAR_START_MONTH or (month == FISCAL_YEAR_START_MONTH and day < FISCAL_YEAR_START_DAY):
        # Gehört zum vorherigen Geschäftsjahr
        return f"{year-1}/{year}"
    else:
        # Gehört zum aktuellen Geschäftsjahr
        return f"{year}/{year+1}"

def get_current_fiscal_year() -> str:
    """Gibt das aktuelle Geschäftsjahr zurück"""
    return get_fiscal_year(datetime.now(timezone.utc))

# Enums
class UserRole(str, Enum):
    admin = "admin"
    spiess = "spiess"
    vorstand = "vorstand"
    mitglied = "mitglied"

class MemberStatus(str, Enum):
    aktiv = "aktiv"
    passiv = "passiv"
    archiviert = "archiviert"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: UserRole
    member_id: Optional[str] = None  # Verknüpfung zu Mitglied (nur für Rolle "mitglied")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    message: str
    role: str
    username: str
    member_id: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# Audit Log Model
class AuditAction(str, Enum):
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: AuditAction
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None

# Audit Log Helper
async def log_audit(
    action: AuditAction,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    audit_entry = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        username=username,
        details=details,
        ip_address=ip_address
    )
    await db.audit_logs.insert_one(audit_entry.model_dump())
    logger.info(f"AUDIT: {action.value} - {resource_type} - User: {username} - IP: {ip_address}")

class Member(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    firstName: str
    lastName: str
    status: MemberStatus = MemberStatus.aktiv
    archived_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def name(self) -> str:
        return f"{self.firstName} {self.lastName}"

class MemberCreate(BaseModel):
    firstName: str
    lastName: str
    status: MemberStatus = MemberStatus.aktiv

class FineType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    amount: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FineTypeCreate(BaseModel):
    label: str
    amount: Optional[float] = None

class Fine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    fine_type_id: str
    fine_type_label: str
    amount: float
    fiscal_year: str  # z.B. "2025/2026"
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class FineCreate(BaseModel):
    member_id: str
    fine_type_id: str
    amount: float
    date: Optional[str] = None  # ISO date string, optional
    notes: Optional[str] = None

class FineUpdate(BaseModel):
    amount: Optional[float] = None
    notes: Optional[str] = None

class RankingEntry(BaseModel):
    member_id: str
    member_name: str
    total: float
    rank: int

class Statistics(BaseModel):
    fiscal_year: str
    total_fines: int
    total_amount: float
    sau: Optional[RankingEntry] = None
    laemmchen: Optional[RankingEntry] = None
    ranking: List[RankingEntry]

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def require_admin(payload: dict = Depends(verify_token)):
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin-Berechtigung erforderlich")
    return payload

def require_admin_or_spiess(payload: dict = Depends(verify_token)):
    """Erlaubt Zugriff für Admin und Spiess"""
    if payload.get('role') not in ['admin', 'spiess']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin- oder Spiess-Berechtigung erforderlich")
    return payload

def require_any_role(payload: dict = Depends(verify_token)):
    """Erlaubt Zugriff für Admin, Spiess und Vorstand"""
    if payload.get('role') not in ['admin', 'spiess', 'vorstand']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
    return payload

def require_authenticated(payload: dict = Depends(verify_token)):
    """Erlaubt Zugriff für alle authentifizierten Benutzer (inkl. Mitglied)"""
    return payload

# Brute-Force-Schutz Hilfsfunktionen
async def get_failed_login_attempts(username: str, ip_address: str) -> int:
    """Zählt fehlgeschlagene Login-Versuche im Zeitfenster"""
    window_start = datetime.now(timezone.utc) - timedelta(minutes=LOGIN_ATTEMPT_WINDOW_MINUTES)
    
    count = await db.login_attempts.count_documents({
        "$or": [
            {"username": username},
            {"ip_address": ip_address}
        ],
        "success": False,
        "timestamp": {"$gte": window_start}
    })
    return count

async def is_account_locked(username: str, ip_address: str) -> tuple[bool, int]:
    """Prüft ob Account/IP gesperrt ist und gibt verbleibende Sperrzeit zurück"""
    lockout = await db.account_lockouts.find_one({
        "$or": [
            {"username": username},
            {"ip_address": ip_address}
        ],
        "locked_until": {"$gt": datetime.now(timezone.utc)}
    })
    
    if lockout:
        locked_until = lockout["locked_until"]
        # Konvertiere zu aware datetime falls nötig
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        remaining = (locked_until - datetime.now(timezone.utc)).total_seconds()
        return True, int(remaining / 60) + 1
    return False, 0

async def record_login_attempt(username: str, ip_address: str, success: bool):
    """Speichert Login-Versuch"""
    await db.login_attempts.insert_one({
        "username": username,
        "ip_address": ip_address,
        "success": success,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Bei Fehlversuch prüfen ob Sperre nötig
    if not success:
        failed_attempts = await get_failed_login_attempts(username, ip_address)
        if failed_attempts >= MAX_LOGIN_ATTEMPTS:
            await lock_account(username, ip_address)

async def lock_account(username: str, ip_address: str):
    """Sperrt Account und IP"""
    locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    
    # Sperre für Benutzername
    await db.account_lockouts.update_one(
        {"username": username},
        {"$set": {
            "username": username,
            "locked_until": locked_until,
            "reason": "Zu viele fehlgeschlagene Login-Versuche"
        }},
        upsert=True
    )
    
    # Sperre für IP
    await db.account_lockouts.update_one(
        {"ip_address": ip_address},
        {"$set": {
            "ip_address": ip_address,
            "locked_until": locked_until,
            "reason": "Zu viele fehlgeschlagene Login-Versuche"
        }},
        upsert=True
    )
    
    logger.warning(f"SECURITY: Account/IP gesperrt - User: {username}, IP: {ip_address}")

async def clear_lockout(username: str):
    """Entfernt Sperre nach erfolgreichem Login"""
    await db.account_lockouts.delete_many({"username": username})

@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, login_data: LoginRequest):
    ip_address = get_remote_address(request)
    
    # Brute-Force-Schutz: Prüfe ob gesperrt
    locked, remaining_minutes = await is_account_locked(login_data.username, ip_address)
    if locked:
        await log_audit(
            action=AuditAction.LOGIN_FAILED,
            resource_type="auth",
            username=login_data.username,
            details=f"Account gesperrt - noch {remaining_minutes} Minuten",
            ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Zu viele fehlgeschlagene Versuche. Bitte warten Sie {remaining_minutes} Minuten."
        )
    
    # Find user by username
    user_doc = await db.users.find_one({"username": login_data.username}, {"_id": 0})
    
    if not user_doc:
        # Fehlversuch protokollieren
        await record_login_attempt(login_data.username, ip_address, False)
        await log_audit(
            action=AuditAction.LOGIN_FAILED,
            resource_type="auth",
            username=login_data.username,
            details="Benutzer nicht gefunden",
            ip_address=ip_address
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzername oder Passwort falsch")
    
    # Verify password
    if not pwd_context.verify(login_data.password, user_doc['password_hash']):
        # Fehlversuch protokollieren
        await record_login_attempt(login_data.username, ip_address, False)
        await log_audit(
            action=AuditAction.LOGIN_FAILED,
            resource_type="auth",
            user_id=user_doc.get('id'),
            username=login_data.username,
            details="Falsches Passwort",
            ip_address=ip_address
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzername oder Passwort falsch")
    
    # Erfolgreicher Login - Sperre aufheben und Versuch protokollieren
    await clear_lockout(login_data.username)
    await record_login_attempt(login_data.username, ip_address, True)
    
    token = jwt.encode(
        {
            'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
            'iat': datetime.now(timezone.utc),
            'sub': user_doc['id'],
            'username': user_doc['username'],
            'role': user_doc['role'],
            'member_id': user_doc.get('member_id')  # Für Mitglied-Rolle
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    
    # Log successful login
    await log_audit(
        action=AuditAction.LOGIN_SUCCESS,
        resource_type="auth",
        user_id=user_doc['id'],
        username=user_doc['username'],
        ip_address=ip_address
    )
    
    return LoginResponse(
        token=token, 
        message="Login erfolgreich",
        role=user_doc['role'],
        username=user_doc['username'],
        member_id=user_doc.get('member_id')
    )

@api_router.post("/auth/logout")
async def logout(request: Request, auth=Depends(verify_token)):
    """Logout - Token wird clientseitig gelöscht, hier nur Audit Log"""
    ip_address = get_remote_address(request)
    await log_audit(
        action=AuditAction.LOGOUT,
        resource_type="auth",
        user_id=auth.get('sub'),
        username=auth.get('username'),
        ip_address=ip_address
    )
    return {"message": "Logout erfolgreich"}

@api_router.put("/auth/change-password")
async def change_password(request: Request, data: ChangePasswordRequest, auth=Depends(verify_token)):
    ip_address = get_remote_address(request)
    user_id = auth.get('sub')
    username = auth.get('username')
    
    # Benutzer aus DB holen
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Aktuelles Passwort prüfen
    if not pwd_context.verify(data.current_password, user_doc['password_hash']):
        await log_audit(
            action=AuditAction.UPDATE,
            resource_type="password",
            user_id=user_id,
            username=username,
            details="Passwortänderung fehlgeschlagen - falsches aktuelles Passwort",
            ip_address=ip_address
        )
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")
    
    # Neues Passwort validieren
    is_valid, error_msg = validate_password(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Neues Passwort hashen und speichern
    new_password_hash = pwd_context.hash(data.new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    # Audit Log
    await log_audit(
        action=AuditAction.UPDATE,
        resource_type="password",
        user_id=user_id,
        username=username,
        details="Passwort erfolgreich geändert",
        ip_address=ip_address
    )
    
    return {"message": "Passwort erfolgreich geändert"}

# ============== Benutzerverwaltung (nur Admin) ==============

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    member_id: Optional[str] = None
    created_at: Optional[str] = None

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: UserRole
    member_id: Optional[str] = None  # Pflicht wenn role=mitglied

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(auth=Depends(require_admin)):
    """Alle Benutzer abrufen (nur Admin)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    # Konvertiere datetime zu string falls nötig
    for user in users:
        if user.get('created_at') and not isinstance(user['created_at'], str):
            user['created_at'] = user['created_at'].isoformat()
    return users

@api_router.post("/users", response_model=UserResponse)
async def create_user(request: Request, data: UserCreateRequest, auth=Depends(require_admin)):
    """Neuen Benutzer erstellen (nur Admin)"""
    ip_address = get_remote_address(request)
    
    # Prüfen ob Benutzername bereits existiert
    existing = await db.users.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzername existiert bereits")
    
    # Passwort validieren
    is_valid, error_msg = validate_password(data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Bei Mitglied-Rolle muss member_id angegeben werden, bei Vorstand und Spieß optional
    if data.role == UserRole.mitglied:
        if not data.member_id:
            raise HTTPException(status_code=400, detail="Bei Rolle 'Mitglied' muss ein Mitglied ausgewählt werden")
    
    # Wenn member_id angegeben ist, validieren (für Mitglied, Vorstand und Spieß)
    if data.member_id:
        # Prüfen ob Mitglied existiert und nicht archiviert ist
        member = await db.members.find_one({"id": data.member_id})
        if not member:
            raise HTTPException(status_code=400, detail="Mitglied nicht gefunden")
        if member.get('status') == 'archiviert':
            raise HTTPException(status_code=400, detail="Archivierte Mitglieder können keinen Benutzeraccount haben")
        # Prüfen ob Mitglied bereits einen Account hat
        existing_member_user = await db.users.find_one({"member_id": data.member_id})
        if existing_member_user:
            raise HTTPException(status_code=400, detail="Dieses Mitglied hat bereits einen Benutzeraccount")
    
    # Benutzer erstellen - member_id für Mitglied, Vorstand und Spieß speichern
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "password_hash": pwd_context.hash(data.password),
        "role": data.role.value,
        "member_id": data.member_id if data.role in [UserRole.mitglied, UserRole.vorstand, UserRole.spiess] else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Audit Log
    await log_audit(
        action=AuditAction.CREATE,
        resource_type="user",
        resource_id=user_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Benutzer erstellt: {data.username} (Rolle: {data.role.value})",
        ip_address=ip_address
    )
    
    return UserResponse(
        id=user_id,
        username=data.username,
        role=data.role.value,
        member_id=user_doc.get("member_id"),
        created_at=user_doc["created_at"]
    )

@api_router.delete("/users/{user_id}")
async def delete_user(request: Request, user_id: str, auth=Depends(require_admin)):
    """Benutzer löschen (nur Admin)"""
    ip_address = get_remote_address(request)
    
    # Benutzer finden
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Admin kann sich nicht selbst löschen
    if user_id == auth.get('sub'):
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst löschen")
    
    # Letzten Admin nicht löschen
    if user.get('role') == 'admin':
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Der letzte Admin kann nicht gelöscht werden")
    
    await db.users.delete_one({"id": user_id})
    
    # Audit Log
    await log_audit(
        action=AuditAction.DELETE,
        resource_type="user",
        resource_id=user_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Benutzer gelöscht: {user.get('username')}",
        ip_address=ip_address
    )
    
    return {"message": "Benutzer gelöscht"}

class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    member_id: Optional[str] = None

@api_router.put("/users/{user_id}")
async def update_user(request: Request, user_id: str, data: UserUpdateRequest, auth=Depends(require_admin)):
    """Benutzer bearbeiten (nur Admin)"""
    ip_address = get_remote_address(request)
    
    # Benutzer finden
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    update_data = {}
    
    # Benutzername ändern
    if data.username and data.username != user.get('username'):
        existing = await db.users.find_one({"username": data.username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Benutzername existiert bereits")
        update_data["username"] = data.username
    
    # Rolle ändern
    if data.role:
        # Letzten Admin nicht ändern
        if user.get('role') == 'admin' and data.role != UserRole.admin:
            admin_count = await db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Der letzte Admin kann nicht geändert werden")
        update_data["role"] = data.role.value
    
    # Member_id ändern (für Mitglied, Vorstand und Spieß)
    new_role = data.role.value if data.role else user.get('role')
    if new_role in ['mitglied', 'vorstand', 'spiess']:
        if data.member_id is not None:
            if data.member_id:  # Nicht leer
                # Prüfen ob Mitglied existiert
                member = await db.members.find_one({"id": data.member_id})
                if not member:
                    raise HTTPException(status_code=400, detail="Mitglied nicht gefunden")
                if member.get('status') == 'archiviert':
                    raise HTTPException(status_code=400, detail="Archivierte Mitglieder können nicht verknüpft werden")
                # Prüfen ob Mitglied bereits einem anderen Benutzer zugeordnet ist
                existing_user = await db.users.find_one({"member_id": data.member_id, "id": {"$ne": user_id}})
                if existing_user:
                    raise HTTPException(status_code=400, detail="Dieses Mitglied ist bereits einem anderen Benutzer zugeordnet")
                update_data["member_id"] = data.member_id
            else:
                # Leerer String = Mitglied entfernen (nur für Vorstand erlaubt)
                if new_role == 'mitglied':
                    raise HTTPException(status_code=400, detail="Mitglied-Benutzer müssen mit einem Mitglied verknüpft sein")
                update_data["member_id"] = None
    else:
        # Andere Rollen haben keine member_id
        update_data["member_id"] = None
    
    if not update_data:
        return UserResponse(
            id=user_id,
            username=user.get('username'),
            role=user.get('role'),
            member_id=user.get('member_id'),
            created_at=user.get('created_at')
        )
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Aktualisierte Daten holen
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    # Audit Log
    await log_audit(
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=user_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Benutzer bearbeitet: {updated_user.get('username')}",
        ip_address=ip_address
    )
    
    return UserResponse(
        id=user_id,
        username=updated_user.get('username'),
        role=updated_user.get('role'),
        member_id=updated_user.get('member_id'),
        created_at=updated_user.get('created_at')
    )

class ResetPasswordRequest(BaseModel):
    new_password: str

@api_router.put("/users/{user_id}/reset-password")
async def reset_user_password(request: Request, user_id: str, data: ResetPasswordRequest, auth=Depends(require_admin)):
    """Passwort eines Benutzers zurücksetzen (nur Admin)"""
    ip_address = get_remote_address(request)
    
    # Benutzer finden
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Passwort validieren
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 6 Zeichen lang sein")
    
    # Neues Passwort setzen
    new_password_hash = pwd_context.hash(data.new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    # Audit Log
    await log_audit(
        action=AuditAction.UPDATE,
        resource_type="user",
        resource_id=user_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Passwort zurückgesetzt für: {user.get('username')}",
        ip_address=ip_address
    )
    
    return {"message": "Passwort erfolgreich zurückgesetzt"}

# ============== Mitglieder ==============

@api_router.get("/members")
async def get_members(auth=Depends(verify_token)):
    members = await db.members.find({}, {"_id": 0}).to_list(1000)
    result = []
    for member in members:
        if isinstance(member.get('created_at'), str):
            member['created_at'] = datetime.fromisoformat(member['created_at'])
        # Migration: Alte Daten mit nur 'name' Feld unterstützen
        if 'firstName' not in member and 'name' in member:
            name_parts = member['name'].split(' ', 1)
            member['firstName'] = name_parts[0]
            member['lastName'] = name_parts[1] if len(name_parts) > 1 else ''
        # Default Status auf 'aktiv' wenn leer oder nicht gesetzt
        if not member.get('status'):
            member['status'] = 'aktiv'
        result.append(member)
    return result

@api_router.post("/members", response_model=Member)
async def create_member(request: Request, input: MemberCreate, auth=Depends(require_any_role)):
    member = Member(**input.model_dump())
    doc = member.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.members.insert_one(doc)
    
    full_name = f"{input.firstName} {input.lastName}"
    
    # Audit Log
    await log_audit(
        action=AuditAction.CREATE,
        resource_type="member",
        resource_id=member.id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Mitglied erstellt: {full_name}",
        ip_address=get_remote_address(request)
    )
    
    return member

@api_router.put("/members/{member_id}", response_model=Member)
async def update_member(request: Request, member_id: str, input: MemberCreate, auth=Depends(require_any_role)):
    result = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    update_data = {"firstName": input.firstName, "lastName": input.lastName, "status": input.status}
    
    # Wenn Status auf archiviert wechselt, archived_at setzen
    old_status = result.get('status', 'aktiv')
    if input.status == 'archiviert' and old_status != 'archiviert':
        update_data['archived_at'] = datetime.now(timezone.utc).isoformat()
    # Wenn Status von archiviert auf aktiv/passiv wechselt, archived_at löschen
    elif input.status != 'archiviert' and old_status == 'archiviert':
        update_data['archived_at'] = None
    
    await db.members.update_one({"id": member_id}, {"$set": update_data})
    updated = await db.members.find_one({"id": member_id}, {"_id": 0})
    
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('archived_at'), str):
        updated['archived_at'] = datetime.fromisoformat(updated['archived_at'])
    
    full_name = f"{input.firstName} {input.lastName}"
    
    # Audit Log
    await log_audit(
        action=AuditAction.UPDATE,
        resource_type="member",
        resource_id=member_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Mitglied aktualisiert: {full_name}",
        ip_address=get_remote_address(request)
    )
    
    return Member(**updated)

@api_router.delete("/members/{member_id}")
async def delete_member(request: Request, member_id: str, auth=Depends(require_any_role)):
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    # Nur archivierte Mitglieder können gelöscht werden
    if member.get('status') != 'archiviert':
        raise HTTPException(status_code=400, detail="Nur archivierte Mitglieder können gelöscht werden")
    
    result = await db.members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    await db.fines.delete_many({"member_id": member_id})
    
    # Audit Log
    await log_audit(
        action=AuditAction.DELETE,
        resource_type="member",
        resource_id=member_id,
        user_id=auth.get('sub'),
        username=auth.get('username'),
        details=f"Mitglied gelöscht: {member.get('name') if member else 'unbekannt'}",
        ip_address=get_remote_address(request)
    )
    
    return {"message": "Mitglied gelöscht"}

@api_router.get("/fine-types", response_model=List[FineType])
async def get_fine_types(auth=Depends(verify_token)):
    fine_types = await db.fine_types.find({}, {"_id": 0}).to_list(1000)
    for ft in fine_types:
        if isinstance(ft.get('created_at'), str):
            ft['created_at'] = datetime.fromisoformat(ft['created_at'])
    return fine_types

@api_router.post("/fine-types", response_model=FineType)
async def create_fine_type(input: FineTypeCreate, auth=Depends(require_any_role)):
    fine_type = FineType(**input.model_dump())
    doc = fine_type.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.fine_types.insert_one(doc)
    return fine_type

@api_router.put("/fine-types/{fine_type_id}", response_model=FineType)
async def update_fine_type(fine_type_id: str, input: FineTypeCreate, auth=Depends(require_any_role)):
    result = await db.fine_types.find_one({" id": fine_type_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
    
    await db.fine_types.update_one({"id": fine_type_id}, {"$set": input.model_dump()})
    updated = await db.fine_types.find_one({"id": fine_type_id}, {"_id": 0})
    
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return FineType(**updated)

@api_router.delete("/fine-types/{fine_type_id}")
async def delete_fine_type(fine_type_id: str, auth=Depends(require_any_role)):
    result = await db.fine_types.delete_one({"id": fine_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
    return {"message": "Strafenart gelöscht"}

@api_router.get("/fines", response_model=List[Fine])
async def get_fines(fiscal_year: Optional[str] = None, auth=Depends(require_authenticated)):
    query = {}
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    
    # Mitglieder und Vorstand mit member_id sehen nur eigene Strafen
    role = auth.get('role')
    member_id = auth.get('member_id')
    
    if role == 'mitglied':
        if not member_id:
            return []  # Kein verknüpftes Mitglied
        query["member_id"] = member_id
    elif role == 'vorstand' and member_id:
        # Vorstand mit Mitglied-Verknüpfung sieht nur eigene Strafen
        query["member_id"] = member_id
    
    fines = await db.fines.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for fine in fines:
        if isinstance(fine.get('date'), str):
            fine['date'] = datetime.fromisoformat(fine['date'])
    return fines

@api_router.post("/fines", response_model=Fine)
async def create_fine(input: FineCreate, auth=Depends(require_admin_or_spiess)):
    fine_type = await db.fine_types.find_one({"id": input.fine_type_id}, {"_id": 0})
    if not fine_type:
        raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
    
    member = await db.members.find_one({"id": input.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    # Keine Strafen für archivierte Mitglieder
    if member.get('status') == 'archiviert':
        raise HTTPException(status_code=400, detail="Keine Strafen für archivierte Mitglieder möglich")
    
    fine_data = input.model_dump()
    fine_data['fine_type_label'] = fine_type['label']
    
    # Datum verarbeiten - wenn angegeben, parsen, sonst jetzt
    if input.date:
        try:
            fine_date = datetime.fromisoformat(input.date.replace('Z', '+00:00'))
        except:
            fine_date = datetime.now(timezone.utc)
    else:
        fine_date = datetime.now(timezone.utc)
    
    fine_data['date'] = fine_date
    fine_data['fiscal_year'] = get_fiscal_year(fine_date)
    
    fine = Fine(**fine_data)
    doc = fine.model_dump()
    doc['date'] = doc['date'].isoformat()
    await db.fines.insert_one(doc)
    return fine

@api_router.put("/fines/{fine_id}", response_model=Fine)
async def update_fine(fine_id: str, input: FineUpdate, auth=Depends(require_admin_or_spiess)):
    result = await db.fines.find_one({"id": fine_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Strafe nicht gefunden")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.fines.update_one({"id": fine_id}, {"$set": update_data})
    
    updated = await db.fines.find_one({"id": fine_id}, {"_id": 0})
    if isinstance(updated.get('date'), str):
        updated['date'] = datetime.fromisoformat(updated['date'])
    
    return Fine(**updated)

@api_router.delete("/fines/{fine_id}")
async def delete_fine(fine_id: str, auth=Depends(require_admin_or_spiess)):
    result = await db.fines.delete_one({"id": fine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Strafe nicht gefunden")
    return {"message": "Strafe gelöscht"}

@api_router.get("/statistics", response_model=Statistics)
async def get_statistics(fiscal_year: str, auth=Depends(require_authenticated)):
    # Mitglieder haben keinen Zugriff auf die allgemeine Statistik
    if auth.get('role') == 'mitglied':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
    
    fines = await db.fines.find({"fiscal_year": fiscal_year}, {"_id": 0}).to_list(10000)
    # Nur aktive und passive Mitglieder (keine archivierten)
    members = await db.members.find({"status": {"$ne": "archiviert"}}, {"_id": 0}).to_list(1000)
    
    # Generiere vollständigen Namen aus firstName und lastName
    def get_full_name(m):
        if 'firstName' in m and 'lastName' in m:
            return f"{m['firstName']} {m['lastName']}"
        return m.get('name', 'Unbekannt')
    
    member_map = {m['id']: get_full_name(m) for m in members}
    member_status = {m['id']: m.get('status', 'aktiv') for m in members}
    totals = {}
    
    for fine in fines:
        member_id = fine['member_id']
        # Nur Strafen von nicht-archivierten Mitgliedern zählen
        if member_id not in member_map:
            continue
        if member_id not in totals:
            totals[member_id] = 0
        totals[member_id] += fine['amount']
    
    ranking = []
    for member_id, total in totals.items():
        ranking.append(RankingEntry(
            member_id=member_id,
            member_name=member_map.get(member_id, "Unbekannt"),
            total=total,
            rank=0
        ))
    
    ranking.sort(key=lambda x: x.total, reverse=True)
    for idx, entry in enumerate(ranking):
        entry.rank = idx + 1
    
    sau = ranking[0] if len(ranking) > 0 else None
    laemmchen = ranking[-1] if len(ranking) > 0 else None
    
    return Statistics(
        fiscal_year=fiscal_year,
        total_fines=len(fines),
        total_amount=sum(f['amount'] for f in fines),
        sau=sau,
        laemmchen=laemmchen,
        ranking=ranking
    )

# Persönliche Statistik für Mitglieder
class PersonalStatistics(BaseModel):
    fiscal_year: str
    member_name: str
    total_fines: int
    total_amount: float
    rank: Optional[int] = None
    total_members: Optional[int] = None

@api_router.get("/statistics/personal", response_model=PersonalStatistics)
async def get_personal_statistics(fiscal_year: str, auth=Depends(require_authenticated)):
    """Persönliche Statistik für ein Mitglied oder Vorstand"""
    member_id = auth.get('member_id')
    role = auth.get('role')
    username = auth.get('username', 'Unbekannt')
    
    # Wenn kein Mitglied verknüpft ist (z.B. Vorstand ohne member_id)
    if not member_id:
        return PersonalStatistics(
            fiscal_year=fiscal_year,
            member_name=username,
            total_fines=0,
            total_amount=0.0,
            rank=None,
            total_members=None
        )
    
    # Mitglied-Daten holen
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        return PersonalStatistics(
            fiscal_year=fiscal_year,
            member_name=username,
            total_fines=0,
            total_amount=0.0,
            rank=None,
            total_members=None
        )
    
    member_name = f"{member.get('firstName', '')} {member.get('lastName', '')}".strip() or member.get('name', 'Unbekannt')
    
    # Eigene Strafen
    own_fines = await db.fines.find({"fiscal_year": fiscal_year, "member_id": member_id}, {"_id": 0}).to_list(10000)
    
    # Ranking berechnen (alle nicht-archivierten Mitglieder)
    all_fines = await db.fines.find({"fiscal_year": fiscal_year}, {"_id": 0}).to_list(10000)
    all_members = await db.members.find({"status": {"$ne": "archiviert"}}, {"_id": 0}).to_list(1000)
    member_ids = {m['id'] for m in all_members}
    
    totals = {}
    for fine in all_fines:
        mid = fine['member_id']
        if mid in member_ids:
            totals[mid] = totals.get(mid, 0) + fine['amount']
    
    # Sortiere nach Summe
    sorted_members = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    rank = None
    for idx, (mid, total) in enumerate(sorted_members):
        if mid == member_id:
            rank = idx + 1
            break
    
    return PersonalStatistics(
        fiscal_year=fiscal_year,
        member_name=member_name,
        total_fines=len(own_fines),
        total_amount=sum(f['amount'] for f in own_fines),
        rank=rank,
        total_members=len(totals)
    )

@api_router.get("/fiscal-years")
async def get_fiscal_years(auth=Depends(verify_token)):
    pipeline = [
        {"$group": {"_id": "$fiscal_year"}},
        {"$sort": {"_id": -1}}
    ]
    result = await db.fines.aggregate(pipeline).to_list(100)
    fiscal_years = [r['_id'] for r in result if r['_id']]
    
    # Wenn keine Geschäftsjahre in DB, füge aktuelles hinzu
    if not fiscal_years:
        fiscal_years = [get_current_fiscal_year()]
    
    return {"fiscal_years": fiscal_years}

# Audit Log Endpoint (nur Admin)
@api_router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    action: Optional[str] = None,
    auth=Depends(require_admin)
):
    query = {}
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs, "total": len(logs)}

# Health Check Endpoint (für Docker und Monitoring)
@app.get("/health")
async def health_check():
    """Health check endpoint für Docker und Load Balancer"""
    try:
        # Prüfe MongoDB Verbindung
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'https://rhnzl.sau-index.de').split(','),
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("startup")
async def startup_db_client():
    """Initialisierung beim Start"""
    try:
        # Admin-Benutzer erstellen falls nicht vorhanden
        existing_admin = await db.users.find_one({"username": "admin"})
        if not existing_admin:
            admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
            admin_user = {
                "id": str(uuid.uuid4()),
                "username": "admin",
                "password_hash": pwd_context.hash(admin_password),
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_user)
            logger.info("Admin-Benutzer erstellt mit Passwort aus Umgebungsvariable")
        else:
            logger.info("Admin-Benutzer existiert bereits")
        
        # Indizes für Brute-Force-Schutz erstellen
        await db.login_attempts.create_index("timestamp", expireAfterSeconds=3600)  # Auto-Löschung nach 1h
        await db.login_attempts.create_index([("username", 1), ("timestamp", -1)])
        await db.login_attempts.create_index([("ip_address", 1), ("timestamp", -1)])
        await db.account_lockouts.create_index("locked_until", expireAfterSeconds=0)  # Auto-Löschung nach Ablauf
        await db.account_lockouts.create_index("username")
        await db.account_lockouts.create_index("ip_address")
        logger.info("Datenbank-Indizes für Brute-Force-Schutz erstellt")
        
    except Exception as e:
        logger.error(f"Fehler bei der Initialisierung: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()