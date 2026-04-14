from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response, FileResponse
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
from datetime import datetime, timezone, timedelta, date
import jwt
from passlib.context import CryptContext
import secrets
import httpx
import icalendar
import asyncio

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
    created_by: Optional[str] = None

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

# ============ EVENT / KALENDER MODELS ============

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str  # ISO datetime string
    location: Optional[str] = None
    fine_type_id: Optional[str] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    fine_type_id: Optional[str] = None

class EventResponse(BaseModel):
    response: str  # "zugesagt" | "abgesagt"

class EventResponseOut(BaseModel):
    member_id: str
    member_name: str
    response: str
    responded_at: str

class EventOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    date: str
    location: Optional[str] = None
    fine_amount: Optional[float] = None
    fine_type_id: Optional[str] = None
    created_by: str
    created_at: str
    response_open: bool = False
    response_deadline_passed: bool = False
    my_response: Optional[str] = None
    responses: Optional[List[EventResponseOut]] = None
    response_stats: Optional[dict] = None
    source: Optional[str] = None
    ics_uid: Optional[str] = None
    fine_enabled: Optional[bool] = False

class EventFineAssign(BaseModel):
    fine_type_id: Optional[str] = None

class ICSSettingsUpdate(BaseModel):
    ics_url: Optional[str] = None
    sync_enabled: Optional[bool] = None

class ProfileUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    birthday: Optional[str] = None
    joinDate: Optional[str] = None
    joinDateCorps: Optional[str] = None
    street: Optional[str] = None
    zipCode: Optional[str] = None
    city: Optional[str] = None
    confession: Optional[str] = None
    email: Optional[str] = None

class ClubSettingsUpdate(BaseModel):
    founding_date: Optional[str] = None
    fiscal_year_start_month: Optional[int] = None
    club_name: Optional[str] = None

# --- Avatar Storage (Lokal) ---
AVATAR_DIR = os.environ.get("AVATAR_DIR", "/app/data/avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

# --- Logo Storage (Lokal) ---
LOGO_DIR = os.environ.get("LOGO_DIR", "/app/data/logos")
os.makedirs(LOGO_DIR, exist_ok=True)

# Avatar-Konfiguration
AVATAR_ALLOWED_MIMES = {"image/jpeg", "image/png"}
AVATAR_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
AVATAR_MAX_DIMENSION = 512  # Max Breite/Höhe nach Komprimierung
AVATAR_JPEG_QUALITY = 85
MAGIC_BYTES = {
    b'\xff\xd8\xff': "image/jpeg",
    b'\x89PNG': "image/png",
}

def _validate_image_bytes(data: bytes) -> str:
    for magic, mime in MAGIC_BYTES.items():
        if data[:len(magic)] == magic:
            return mime
    raise ValueError("Ungültiges Bildformat. Nur JPG und PNG werden unterstützt.")

def _compress_avatar(data: bytes, detected_mime: str) -> tuple[bytes, str]:
    from PIL import Image, ImageOps
    import io
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    if img.width > AVATAR_MAX_DIMENSION or img.height > AVATAR_MAX_DIMENSION:
        img.thumbnail((AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION), Image.LANCZOS)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=AVATAR_JPEG_QUALITY, optimize=True)
    return buf.getvalue(), "image/jpeg"

def _save_avatar(member_id: str, data: bytes) -> str:
    filename = f"{uuid.uuid4()}.jpg"
    member_dir = os.path.join(AVATAR_DIR, member_id)
    os.makedirs(member_dir, exist_ok=True)
    filepath = os.path.join(member_dir, filename)
    with open(filepath, 'wb') as f:
        f.write(data)
    return f"{member_id}/{filename}"

def _load_avatar(path: str):
    filepath = os.path.join(AVATAR_DIR, path)
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Avatar nicht gefunden")
    with open(filepath, 'rb') as f:
        return f.read(), "image/jpeg"

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
    # Alle Nicht-Admin-Users laden für Zuordnung
    users = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_by_member = {u['member_id']: u for u in users if u.get('member_id')}

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
        # User-Info anreichern
        linked_user = user_by_member.get(member.get('id'))
        if linked_user:
            member['user_info'] = {
                'user_id': linked_user['id'],
                'username': linked_user['username'],
                'role': linked_user['role'],
            }
        else:
            member['user_info'] = None
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
        # App-Zugang automatisch deaktivieren
        deleted_user = await db.users.find_one({"member_id": member_id}, {"_id": 0})
        if deleted_user:
            await db.users.delete_one({"member_id": member_id})
            await log_audit(
                AuditAction.DELETE, "user_access", deleted_user.get('id'),
                auth.get('sub'), auth.get('username'),
                f"App-Zugang automatisch deaktiviert (Archivierung): {deleted_user.get('username')}",
                get_remote_address(request)
            )
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

class MemberAccessRequest(BaseModel):
    username: str
    password: str
    role: UserRole

@api_router.post("/members/{member_id}/access")
async def enable_member_access(member_id: str, data: MemberAccessRequest, request: Request, auth=Depends(require_any_role)):
    """App-Zugang für ein Mitglied aktivieren (User erstellen)"""
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    if member.get('status') == 'archiviert':
        raise HTTPException(status_code=400, detail="Archivierte Mitglieder können keinen App-Zugang haben")

    existing_user = await db.users.find_one({"member_id": member_id})
    if existing_user:
        raise HTTPException(status_code=400, detail="Mitglied hat bereits einen App-Zugang")

    existing_username = await db.users.find_one({"username": data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Benutzername existiert bereits")

    if data.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admin-Rolle kann nicht über Mitglieder vergeben werden")

    is_valid, error_msg = validate_password(data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "password_hash": pwd_context.hash(data.password),
        "role": data.role.value,
        "member_id": member_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    name = f"{member.get('firstName', '')} {member.get('lastName', '')}"
    await log_audit(
        AuditAction.CREATE, "user_access", user_id,
        auth.get('sub'), auth.get('username'),
        f"App-Zugang aktiviert für {name} ({data.username}, {data.role.value})",
        get_remote_address(request)
    )
    return {"message": "App-Zugang aktiviert", "user_id": user_id}

@api_router.delete("/members/{member_id}/access")
async def disable_member_access(member_id: str, request: Request, auth=Depends(require_any_role)):
    """App-Zugang für ein Mitglied deaktivieren (User löschen)"""
    user = await db.users.find_one({"member_id": member_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kein App-Zugang vorhanden")

    await db.users.delete_one({"member_id": member_id})

    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    name = f"{member.get('firstName', '')} {member.get('lastName', '')}" if member else "Unbekannt"
    await log_audit(
        AuditAction.DELETE, "user_access", user.get('id'),
        auth.get('sub'), auth.get('username'),
        f"App-Zugang deaktiviert für {name}",
        get_remote_address(request)
    )
    return {"message": "App-Zugang deaktiviert"}

class MemberAccessUpdateRequest(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None

@api_router.put("/members/{member_id}/access")
async def update_member_access(member_id: str, data: MemberAccessUpdateRequest, request: Request, auth=Depends(require_any_role)):
    """App-Zugang eines Mitglieds aktualisieren"""
    user = await db.users.find_one({"member_id": member_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kein App-Zugang vorhanden")

    update = {}
    if data.username and data.username != user.get('username'):
        existing = await db.users.find_one({"username": data.username})
        if existing:
            raise HTTPException(status_code=400, detail="Benutzername existiert bereits")
        update['username'] = data.username
    if data.role:
        if data.role == UserRole.admin:
            raise HTTPException(status_code=400, detail="Admin-Rolle kann nicht über Mitglieder vergeben werden")
        update['role'] = data.role.value
    if data.password:
        is_valid, error_msg = validate_password(data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        update['password_hash'] = pwd_context.hash(data.password)

    if update:
        await db.users.update_one({"member_id": member_id}, {"$set": update})

    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    name = f"{member.get('firstName', '')} {member.get('lastName', '')}" if member else "Unbekannt"
    await log_audit(
        AuditAction.UPDATE, "user_access", user.get('id'),
        auth.get('sub'), auth.get('username'),
        f"App-Zugang aktualisiert für {name}",
        get_remote_address(request)
    )
    return {"message": "App-Zugang aktualisiert"}

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
    result = await db.fine_types.find_one({"id": fine_type_id}, {"_id": 0})
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

async def _get_vorstand_eligible_member_ids():
    """Gibt Member-IDs zurück, die zu Benutzern mit Rolle 'spiess' oder 'vorstand' verknüpft sind."""
    users = await db.users.find(
        {"role": {"$in": ["spiess", "vorstand"]}, "member_id": {"$ne": None}},
        {"_id": 0, "member_id": 1}
    ).to_list(1000)
    return [u["member_id"] for u in users if u.get("member_id")]

@api_router.get("/fines/eligible-members")
async def get_eligible_members_for_fines(auth=Depends(require_any_role)):
    """Gibt die Mitglieder zurück, für die der aktuelle Benutzer Strafen erstellen darf."""
    role = auth.get('role')
    own_member_id = auth.get('member_id')
    active_members = await db.members.find({"status": {"$ne": "archiviert"}}, {"_id": 0}).to_list(5000)
    
    if role in ['admin', 'spiess']:
        # Spieß: sich selbst ausfiltern
        if role == 'spiess' and own_member_id:
            return [m for m in active_members if m.get("id") != own_member_id]
        return active_members
    
    if role == 'vorstand':
        eligible_ids = await _get_vorstand_eligible_member_ids()
        # Vorstand: sich selbst ausfiltern
        return [m for m in active_members if m.get("id") in eligible_ids and m.get("id") != own_member_id]
    
    return []

@api_router.get("/fines", response_model=List[Fine])
async def get_fines(fiscal_year: Optional[str] = None, auth=Depends(require_authenticated)):
    query = {}
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    
    role = auth.get('role')
    member_id = auth.get('member_id')
    
    if role == 'mitglied':
        if not member_id:
            return []
        query["member_id"] = member_id
    elif role == 'vorstand':
        # Vorstand sieht nur eigene Strafen
        if not member_id:
            return []
        query["member_id"] = member_id
    
    fines = await db.fines.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    for fine in fines:
        if isinstance(fine.get('date'), str):
            fine['date'] = datetime.fromisoformat(fine['date'])
    return fines

@api_router.get("/fines/created-by-me")
async def get_fines_created_by_me(fiscal_year: Optional[str] = None, auth=Depends(require_any_role)):
    """Gibt Strafen zurück, die vom aktuellen Benutzer erstellt wurden."""
    username = auth.get('username')
    query = {"created_by": username}
    if fiscal_year:
        query["fiscal_year"] = fiscal_year
    
    fines = await db.fines.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    
    # Member-Namen hinzufügen
    member_ids = list(set(f.get("member_id") for f in fines if f.get("member_id")))
    members = {}
    if member_ids:
        member_docs = await db.members.find({"id": {"$in": member_ids}}, {"_id": 0, "id": 1, "firstName": 1, "lastName": 1}).to_list(5000)
        members = {m["id"]: f"{m.get('firstName', '')} {m.get('lastName', '')}".strip() for m in member_docs}
    
    result = []
    for fine in fines:
        if isinstance(fine.get('date'), str):
            fine['date'] = datetime.fromisoformat(fine['date'])
        fine['member_name'] = members.get(fine.get('member_id'), 'Unbekannt')
        result.append(fine)
    return result


@api_router.post("/fines", response_model=Fine)
async def create_fine(input: FineCreate, auth=Depends(require_any_role)):
    fine_type = await db.fine_types.find_one({"id": input.fine_type_id}, {"_id": 0})
    if not fine_type:
        raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
    
    member = await db.members.find_one({"id": input.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    
    # Keine Strafen für archivierte Mitglieder
    if member.get('status') == 'archiviert':
        raise HTTPException(status_code=400, detail="Keine Strafen für archivierte Mitglieder möglich")
    
    # Vorstand darf nur Strafen für Spieß/Vorstand-verknüpfte Mitglieder erstellen
    role = auth.get('role')
    own_member_id = auth.get('member_id')
    
    # Spieß und Vorstand dürfen sich selbst keine Strafen zuordnen
    if role in ['spiess', 'vorstand'] and own_member_id and input.member_id == own_member_id:
        raise HTTPException(status_code=403, detail="Du kannst dir selbst keine Strafe zuordnen")
    
    if role == 'vorstand':
        eligible_ids = await _get_vorstand_eligible_member_ids()
        if input.member_id not in eligible_ids:
            raise HTTPException(status_code=403, detail="Vorstand darf nur Strafen für Spieß und Vorstand erstellen")
    
    fine_data = input.model_dump()
    fine_data['fine_type_label'] = fine_type['label']
    
    # Datum verarbeiten - wenn angegeben, parsen, sonst jetzt
    if input.date:
        try:
            fine_date = datetime.fromisoformat(input.date.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            fine_date = datetime.now(timezone.utc)
    else:
        fine_date = datetime.now(timezone.utc)
    
    fine_data['date'] = fine_date
    fine_data['fiscal_year'] = get_fiscal_year(fine_date)
    fine_data['created_by'] = auth.get('username')
    
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
    # Nur Admin, Spieß und Vorstand haben Zugriff auf die allgemeine Statistik
    role = auth.get('role')
    if role not in ('admin', 'spiess', 'vorstand'):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung")
    
    # Nicht-archivierte Mitglieder laden (nur benötigte Felder)
    members = await db.members.find(
        {"status": {"$ne": "archiviert"}},
        {"_id": 0, "id": 1, "firstName": 1, "lastName": 1, "name": 1}
    ).to_list(1000)
    
    member_map = {}
    for m in members:
        if 'firstName' in m and 'lastName' in m:
            member_map[m['id']] = f"{m['firstName']} {m['lastName']}"
        else:
            member_map[m['id']] = m.get('name', 'Unbekannt')
    
    active_member_ids = list(member_map.keys())
    
    # Aggregation Pipeline: Summen pro Mitglied direkt in MongoDB berechnen
    pipeline = [
        {"$match": {"fiscal_year": fiscal_year, "member_id": {"$in": active_member_ids}}},
        {"$group": {
            "_id": "$member_id",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]
    agg_results = await db.fines.aggregate(pipeline).to_list(1000)
    
    # Gesamtstatistik via separate Aggregation (inkl. Strafen archivierter Mitglieder für Gesamtzählung)
    totals_pipeline = [
        {"$match": {"fiscal_year": fiscal_year}},
        {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}, "total_count": {"$sum": 1}}}
    ]
    totals_result = await db.fines.aggregate(totals_pipeline).to_list(1)
    total_fines = totals_result[0]["total_count"] if totals_result else 0
    total_amount = totals_result[0]["total_amount"] if totals_result else 0.0
    
    ranking = []
    for idx, r in enumerate(agg_results):
        ranking.append(RankingEntry(
            member_id=r["_id"],
            member_name=member_map.get(r["_id"], "Unbekannt"),
            total=r["total"],
            rank=idx + 1
        ))
    
    sau = ranking[0] if ranking else None
    laemmchen = ranking[-1] if ranking else None
    
    return Statistics(
        fiscal_year=fiscal_year,
        total_fines=total_fines,
        total_amount=total_amount,
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
    username = auth.get('username', 'Unbekannt')
    
    if not member_id:
        return PersonalStatistics(
            fiscal_year=fiscal_year,
            member_name=username,
            total_fines=0,
            total_amount=0.0,
            rank=None,
            total_members=None
        )
    
    # Mitglied-Name laden (nur benötigte Felder)
    member = await db.members.find_one(
        {"id": member_id},
        {"_id": 0, "firstName": 1, "lastName": 1, "name": 1}
    )
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
    
    # Nicht-archivierte Mitglieder-IDs
    active_members = await db.members.find(
        {"status": {"$ne": "archiviert"}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    active_ids = [m['id'] for m in active_members]
    
    # Aggregation: Alle Summen pro Mitglied + eigene Statistik in einem Query
    pipeline = [
        {"$match": {"fiscal_year": fiscal_year, "member_id": {"$in": active_ids}}},
        {"$group": {
            "_id": "$member_id",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]
    agg_results = await db.fines.aggregate(pipeline).to_list(1000)
    
    # Rank und eigene Stats aus Aggregation ableiten
    rank = None
    own_total = 0.0
    own_count = 0
    for idx, r in enumerate(agg_results):
        if r["_id"] == member_id:
            rank = idx + 1
            own_total = r["total"]
            own_count = r["count"]
            break
    
    return PersonalStatistics(
        fiscal_year=fiscal_year,
        member_name=member_name,
        total_fines=own_count,
        total_amount=own_total,
        rank=rank,
        total_members=len(agg_results)
    )

@api_router.get("/fiscal-years")
async def get_fiscal_years(auth=Depends(verify_token)):
    pipeline = [
        {"$group": {"_id": "$fiscal_year"}},
        {"$sort": {"_id": -1}}
    ]
    result = await db.fines.aggregate(pipeline).to_list(100)
    fiscal_years = [r['_id'] for r in result if r['_id']]
    
    # Aktuelles Geschäftsjahr immer einschließen
    current_fy = get_current_fiscal_year()
    if current_fy not in fiscal_years:
        fiscal_years.insert(0, current_fy)
    
    return {"fiscal_years": fiscal_years}

# Audit Log Endpoint (nur Admin)
@api_router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    action: Optional[str] = None,
    auth=Depends(require_any_role)
):
    query = {}
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs, "total": len(logs)}

# ============ EVENT / KALENDER ENDPOINTS ============

async def _get_member_name(member_id: str) -> str:
    m = await db.members.find_one({"id": member_id}, {"_id": 0, "firstName": 1, "lastName": 1})
    if m:
        return f"{m.get('firstName', '')} {m.get('lastName', '')}".strip()
    return "Unbekannt"

async def _check_and_assign_fines():
    """Prüft alle Events und vergibt automatisch Strafen bei fehlender/verspäteter Rückmeldung"""
    now = datetime.now(timezone.utc)
    
    # Events deren Deadline (24h vorher) abgelaufen ist und die noch nicht verarbeitet wurden
    events = await db.events.find(
        {"fines_processed": {"$ne": True}, "fine_amount": {"$gt": 0}, "fine_enabled": True},
        {"_id": 0}
    ).to_list(1000)
    
    for event in events:
        event_date = datetime.fromisoformat(event['date'])
        if event_date.tzinfo is None:
            event_date = event_date.replace(tzinfo=timezone.utc)
        deadline = event_date - timedelta(hours=24)
        
        if now < deadline:
            continue
        
        # Alle aktiven Mitglieder
        active_members = await db.members.find(
            {"status": {"$in": ["aktiv", "passiv"]}},
            {"_id": 0, "id": 1, "firstName": 1, "lastName": 1}
        ).to_list(1000)
        
        # Alle Antworten für dieses Event
        responses = await db.event_responses.find(
            {"event_id": event['id']},
            {"_id": 0}
        ).to_list(1000)
        response_map = {r['member_id']: r for r in responses}
        
        fine_type_id = event.get('fine_type_id')
        if not fine_type_id:
            continue
        
        fine_type = await db.fine_types.find_one({"id": fine_type_id}, {"_id": 0})
        if not fine_type:
            continue
        
        for member in active_members:
            member_id = member['id']
            resp = response_map.get(member_id)
            
            should_fine = False
            fine_reason = ""
            
            if not resp:
                # Keine Rückmeldung
                should_fine = True
                fine_reason = f"Keine Rückmeldung für: {event['title']}"
            elif resp['response'] == 'abgesagt':
                # Zu spät abgesagt (weniger als 24h vorher)
                responded_at = datetime.fromisoformat(resp['responded_at'])
                if responded_at.tzinfo is None:
                    responded_at = responded_at.replace(tzinfo=timezone.utc)
                if responded_at > deadline:
                    should_fine = True
                    fine_reason = f"Verspätete Absage für: {event['title']}"
            # zugesagt = keine Strafe
            
            if should_fine:
                # Prüfen ob bereits eine Strafe für dieses Event + Mitglied existiert
                existing = await db.fines.find_one({
                    "member_id": member_id,
                    "fine_type_id": fine_type_id,
                    "notes": {"$regex": f"Event: {event['id']}"}
                })
                if existing:
                    continue
                
                fine_date = event_date
                fine_data = {
                    "id": str(uuid.uuid4()),
                    "member_id": member_id,
                    "fine_type_id": fine_type_id,
                    "fine_type_label": fine_type['label'],
                    "amount": event['fine_amount'],
                    "fiscal_year": get_fiscal_year(fine_date),
                    "date": fine_date.isoformat(),
                    "notes": f"{fine_reason} | Event: {event['id']}"
                }
                await db.fines.insert_one(fine_data)
                member_name = f"{member.get('firstName', '')} {member.get('lastName', '')}".strip()
                logger.info(f"AUTO-STRAFE: {member_name} - {fine_reason} - {event['fine_amount']}€")
        
        # Event als verarbeitet markieren
        await db.events.update_one({"id": event['id']}, {"$set": {"fines_processed": True}})
    
    return True

@api_router.post("/events")
async def create_event(input: EventCreate, request: Request, auth=Depends(require_any_role)):
    """Termin erstellen (Admin, Spieß, Vorstand)"""
    event_date = datetime.fromisoformat(input.date.replace('Z', '+00:00'))
    
    event_id = str(uuid.uuid4())
    fine_type_id = None
    fine_amount = 0
    fine_enabled = False
    
    # Strafenart nachschlagen wenn angegeben
    if input.fine_type_id:
        fine_type = await db.fine_types.find_one({"id": input.fine_type_id}, {"_id": 0})
        if not fine_type:
            raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
        fine_type_id = input.fine_type_id
        fine_amount = fine_type.get('amount', 0)
        fine_enabled = True
    
    event_doc = {
        "id": event_id,
        "title": input.title,
        "description": input.description or "",
        "date": event_date.isoformat(),
        "location": input.location or "",
        "fine_amount": fine_amount,
        "fine_type_id": fine_type_id,
        "fine_enabled": fine_enabled,
        "created_by": auth.get('username', ''),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fines_processed": False,
        "source": "manual"
    }
    await db.events.insert_one(event_doc)
    
    await log_audit(
        AuditAction.CREATE, "event", event_id,
        auth.get('user_id'), auth.get('username'),
        f"Termin erstellt: {input.title}",
        request.client.host if request.client else None
    )
    
    return {"message": "Termin erstellt", "id": event_id}

@api_router.get("/events")
async def get_events(auth=Depends(require_authenticated)):
    """Alle Termine laden + automatische Strafenprüfung"""
    # Automatische Strafenprüfung bei jedem Abruf
    await _check_and_assign_fines()
    
    events = await db.events.find({}, {"_id": 0}).sort("date", 1).to_list(1000)
    now = datetime.now(timezone.utc)
    role = auth.get('role')
    member_id = auth.get('member_id')
    
    # Alle Mitglieder für Namen-Lookup
    members = await db.members.find(
        {"status": {"$in": ["aktiv", "passiv"]}},
        {"_id": 0, "id": 1, "firstName": 1, "lastName": 1}
    ).to_list(1000)
    member_map = {m['id']: f"{m.get('firstName', '')} {m.get('lastName', '')}".strip() for m in members}
    
    result = []
    for event in events:
        event_date = datetime.fromisoformat(event['date'])
        if event_date.tzinfo is None:
            event_date = event_date.replace(tzinfo=timezone.utc)
        response_open_from = event_date - timedelta(days=30)
        response_deadline = event_date - timedelta(hours=24)
        
        is_response_open = now >= response_open_from and now <= response_deadline
        deadline_passed = now > response_deadline
        
        out = EventOut(
            id=event['id'],
            title=event['title'],
            description=event.get('description', ''),
            date=event['date'],
            location=event.get('location', ''),
            fine_amount=event.get('fine_amount', 0),
            fine_type_id=event.get('fine_type_id'),
            created_by=event.get('created_by', ''),
            created_at=event.get('created_at', ''),
            response_open=is_response_open,
            response_deadline_passed=deadline_passed,
            source=event.get('source'),
            ics_uid=event.get('ics_uid'),
            fine_enabled=event.get('fine_enabled', False),
        )
        
        # Eigene Antwort laden (für alle Rollen mit member_id)
        if member_id:
            my_resp = await db.event_responses.find_one(
                {"event_id": event['id'], "member_id": member_id},
                {"_id": 0}
            )
            if my_resp:
                out.my_response = my_resp['response']
        
        # Erweiterte Übersicht für Admin, Spieß, Vorstand
        if role in ['admin', 'spiess', 'vorstand']:
            responses = await db.event_responses.find(
                {"event_id": event['id']},
                {"_id": 0}
            ).to_list(1000)
            
            resp_list = []
            responded_ids = set()
            zugesagt = 0
            abgesagt = 0
            for r in responses:
                responded_ids.add(r['member_id'])
                name = member_map.get(r['member_id'], 'Unbekannt')
                resp_list.append(EventResponseOut(
                    member_id=r['member_id'],
                    member_name=name,
                    response=r['response'],
                    responded_at=r['responded_at']
                ))
                if r['response'] == 'zugesagt':
                    zugesagt += 1
                else:
                    abgesagt += 1
            
            keine_antwort = len(member_map) - len(responded_ids)
            
            out.responses = resp_list
            out.response_stats = {
                "zugesagt": zugesagt,
                "abgesagt": abgesagt,
                "keine_antwort": keine_antwort,
                "gesamt": len(member_map)
            }
        
        result.append(out)
    
    return result

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, auth=Depends(require_authenticated)):
    """Einzelnen Termin laden"""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    return event

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, input: EventUpdate, request: Request, auth=Depends(require_any_role)):
    """Termin aktualisieren (Admin, Spieß, Vorstand)"""
    existing = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if 'date' in update_data:
        update_data['date'] = datetime.fromisoformat(update_data['date'].replace('Z', '+00:00')).isoformat()
    
    # Strafenart aktualisieren wenn fine_type_id geändert wird
    if 'fine_type_id' in update_data:
        fine_type = await db.fine_types.find_one({"id": update_data['fine_type_id']}, {"_id": 0})
        if not fine_type:
            raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
        update_data['fine_amount'] = fine_type.get('amount', 0)
        update_data['fine_enabled'] = True
    
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    await log_audit(
        AuditAction.UPDATE, "event", event_id,
        auth.get('user_id'), auth.get('username'),
        f"Termin aktualisiert: {existing.get('title', '')}",
        request.client.host if request.client else None
    )
    
    return {"message": "Termin aktualisiert"}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, request: Request, auth=Depends(require_any_role)):
    """Termin löschen (Admin, Spieß, Vorstand)"""
    existing = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    
    # Event-spezifische Strafart löschen
    if existing.get('fine_type_id'):
        await db.fine_types.delete_one({"id": existing['fine_type_id']})
    
    # Antworten löschen
    await db.event_responses.delete_many({"event_id": event_id})
    
    await db.events.delete_one({"id": event_id})
    
    await log_audit(
        AuditAction.DELETE, "event", event_id,
        auth.get('user_id'), auth.get('username'),
        f"Termin gelöscht: {existing.get('title', '')}",
        request.client.host if request.client else None
    )
    
    return {"message": "Termin gelöscht"}

@api_router.post("/events/{event_id}/respond")
async def respond_to_event(event_id: str, input: EventResponse, request: Request, auth=Depends(require_authenticated)):
    """Zu-/Absage für einen Termin"""
    member_id = auth.get('member_id')
    if not member_id:
        raise HTTPException(status_code=400, detail="Kein Mitglied verknüpft")
    
    if input.response not in ['zugesagt', 'abgesagt']:
        raise HTTPException(status_code=400, detail="Ungültige Antwort")
    
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    
    event_date = datetime.fromisoformat(event['date'])
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    response_open_from = event_date - timedelta(days=30)
    response_deadline = event_date - timedelta(hours=24)
    
    if now < response_open_from:
        raise HTTPException(status_code=400, detail="Rückmeldung ist noch nicht möglich (frühestens 1 Monat vorher)")
    
    if now > response_deadline:
        raise HTTPException(status_code=400, detail="Rückmeldefrist abgelaufen (24h vor Termin)")
    
    # Upsert: vorhandene Antwort überschreiben
    await db.event_responses.update_one(
        {"event_id": event_id, "member_id": member_id},
        {"$set": {
            "event_id": event_id,
            "member_id": member_id,
            "response": input.response,
            "responded_at": now.isoformat()
        }},
        upsert=True
    )
    
    member_name = await _get_member_name(member_id)
    await log_audit(
        AuditAction.UPDATE, "event_response", event_id,
        auth.get('user_id'), auth.get('username'),
        f"{member_name}: {input.response} für {event['title']}",
        request.client.host if request.client else None
    )
    
    return {"message": f"Erfolgreich {input.response}"}

@api_router.post("/events/check-fines")
async def trigger_fine_check(auth=Depends(require_admin_or_spiess)):
    """Manuelle Strafenprüfung auslösen"""
    await _check_and_assign_fines()
    return {"message": "Strafenprüfung abgeschlossen"}

# ============ ICS KALENDER-SYNCHRONISATION ============

async def _sync_ics_calendar():
    """ICS-Kalender synchronisieren"""
    settings = await db.settings.find_one({"key": "ics_config"}, {"_id": 0})
    if not settings or not settings.get('ics_url') or not settings.get('sync_enabled', False):
        return {"synced": 0, "created": 0, "updated": 0, "deleted": 0, "message": "ICS-Sync nicht konfiguriert"}
    
    ics_url = settings['ics_url']
    
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client_http:
            resp = await client_http.get(ics_url)
            resp.raise_for_status()
    except Exception as e:
        logger.error(f"ICS-Fetch fehlgeschlagen: {e}")
        return {"error": f"ICS-URL nicht erreichbar: {str(e)}"}
    
    try:
        cal = icalendar.Calendar.from_ical(resp.text)
    except Exception as e:
        logger.error(f"ICS-Parse fehlgeschlagen: {e}")
        return {"error": f"ICS-Datei ungültig: {str(e)}"}
    
    # Alle ICS-UIDs aus dem Feed sammeln
    ics_events = {}
    for component in cal.walk():
        if component.name != 'VEVENT':
            continue
        
        uid = str(component.get('UID', ''))
        if not uid:
            continue
        
        summary = str(component.get('SUMMARY', 'Ohne Titel'))
        description = str(component.get('DESCRIPTION', '')) if component.get('DESCRIPTION') else ''
        location = str(component.get('LOCATION', '')) if component.get('LOCATION') else ''
        
        dtstart = component.get('DTSTART')
        if not dtstart:
            continue
        
        dt = dtstart.dt
        if isinstance(dt, date) and not isinstance(dt, datetime):
            dt = datetime.combine(dt, datetime.min.time(), tzinfo=timezone.utc)
        elif dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        
        ics_events[uid] = {
            "title": summary,
            "description": description,
            "location": location,
            "date": dt.isoformat(),
        }
    
    # Bestehende ICS-Events aus DB laden
    existing = await db.events.find({"source": "ics"}, {"_id": 0}).to_list(5000)
    existing_map = {e['ics_uid']: e for e in existing if e.get('ics_uid')}
    
    created = 0
    updated = 0
    deleted = 0
    
    # Neue/aktualisierte Events
    for uid, data in ics_events.items():
        if uid in existing_map:
            ex = existing_map[uid]
            changes = {}
            if ex.get('title') != data['title']:
                changes['title'] = data['title']
            if ex.get('description', '') != data['description']:
                changes['description'] = data['description']
            if ex.get('location', '') != data['location']:
                changes['location'] = data['location']
            if ex.get('date') != data['date']:
                changes['date'] = data['date']
            
            if changes:
                await db.events.update_one({"ics_uid": uid}, {"$set": changes})
                updated += 1
        else:
            event_doc = {
                "id": str(uuid.uuid4()),
                "title": data['title'],
                "description": data['description'],
                "date": data['date'],
                "location": data['location'],
                "fine_amount": 0,
                "fine_type_id": None,
                "fine_enabled": False,
                "created_by": "ICS-Sync",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "fines_processed": False,
                "source": "ics",
                "ics_uid": uid
            }
            await db.events.insert_one(event_doc)
            created += 1
    
    # Gelöschte Events (in ICS nicht mehr vorhanden)
    for uid, ex in existing_map.items():
        if uid not in ics_events:
            if ex.get('fine_type_id'):
                await db.fine_types.delete_one({"id": ex['fine_type_id']})
            await db.event_responses.delete_many({"event_id": ex['id']})
            await db.events.delete_one({"id": ex['id']})
            deleted += 1
    
    # Letzten Sync-Zeitpunkt speichern
    await db.settings.update_one(
        {"key": "ics_config"},
        {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}},
    )
    
    logger.info(f"ICS-Sync abgeschlossen: {created} neu, {updated} aktualisiert, {deleted} gelöscht")
    return {"synced": len(ics_events), "created": created, "updated": updated, "deleted": deleted}

@api_router.get("/settings/ics")
async def get_ics_settings(auth=Depends(require_any_role)):
    """ICS-Einstellungen abrufen (nur Admin)"""
    settings = await db.settings.find_one({"key": "ics_config"}, {"_id": 0})
    if not settings:
        return {"ics_url": "", "sync_enabled": False, "last_sync": None}
    return {
        "ics_url": settings.get("ics_url", ""),
        "sync_enabled": settings.get("sync_enabled", False),
        "last_sync": settings.get("last_sync"),
    }

@api_router.put("/settings/ics")
async def update_ics_settings(input: ICSSettingsUpdate, request: Request, auth=Depends(require_any_role)):
    """ICS-Einstellungen aktualisieren (nur Admin)"""
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    await db.settings.update_one(
        {"key": "ics_config"},
        {"$set": {**update_data, "key": "ics_config"}},
        upsert=True
    )
    
    await log_audit(
        AuditAction.UPDATE, "settings", "ics_config",
        auth.get('user_id'), auth.get('username'),
        "ICS-Einstellungen aktualisiert",
        request.client.host if request.client else None
    )
    
    return {"message": "ICS-Einstellungen gespeichert"}

# ======== CLUB SETTINGS / STAMMDATEN ========

@api_router.get("/club-settings")
async def get_club_settings(auth=Depends(verify_token)):
    """Vereinsstammdaten abrufen"""
    settings = await db.settings.find_one({"key": "club_settings"}, {"_id": 0})
    if not settings:
        return {"founding_date": None, "fiscal_year_start_month": FISCAL_YEAR_START_MONTH, "club_name": None, "has_logo": False}
    
    logo_exists = any(f.startswith("club_logo.") for f in os.listdir(LOGO_DIR)) if os.path.exists(LOGO_DIR) else False
    return {
        "founding_date": settings.get("founding_date"),
        "fiscal_year_start_month": settings.get("fiscal_year_start_month", FISCAL_YEAR_START_MONTH),
        "club_name": settings.get("club_name"),
        "has_logo": logo_exists,
    }

@api_router.put("/club-settings")
async def update_club_settings(input: ClubSettingsUpdate, request: Request, auth=Depends(require_any_role)):
    """Vereinsstammdaten aktualisieren"""
    update_data = {}
    
    if input.club_name is not None:
        update_data["club_name"] = input.club_name.strip() if input.club_name.strip() else None
    
    if input.founding_date is not None:
        # Datumsvalidierung
        try:
            datetime.fromisoformat(input.founding_date)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Ungültiges Datumsformat")
        update_data["founding_date"] = input.founding_date
    
    if input.fiscal_year_start_month is not None:
        if input.fiscal_year_start_month < 1 or input.fiscal_year_start_month > 12:
            raise HTTPException(status_code=400, detail="Startmonat muss zwischen 1 und 12 liegen")
        update_data["fiscal_year_start_month"] = input.fiscal_year_start_month
        # Globale Variable aktualisieren
        global FISCAL_YEAR_START_MONTH
        old_month = FISCAL_YEAR_START_MONTH
        FISCAL_YEAR_START_MONTH = input.fiscal_year_start_month
        
        # Alle Strafen neu berechnen wenn Startmonat geändert
        if old_month != input.fiscal_year_start_month:
            all_fines = await db.fines.find({}, {"_id": 1, "date": 1}).to_list(50000)
            bulk_ops = []
            for fine in all_fines:
                try:
                    d = fine.get('date')
                    if isinstance(d, str):
                        d = datetime.fromisoformat(d.replace('Z', '+00:00'))
                    new_fy = get_fiscal_year(d)
                    bulk_ops.append({"filter": {"_id": fine["_id"]}, "update": {"$set": {"fiscal_year": new_fy}}})
                except Exception:
                    continue
            if bulk_ops:
                from pymongo import UpdateOne
                await db.fines.bulk_write([UpdateOne(op["filter"], op["update"]) for op in bulk_ops])
                logger.info(f"Geschäftsjahr neu berechnet für {len(bulk_ops)} Strafen (Monat: {old_month} → {input.fiscal_year_start_month})")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen")
    
    await db.settings.update_one(
        {"key": "club_settings"},
        {"$set": {**update_data, "key": "club_settings"}},
        upsert=True
    )
    
    await log_audit(
        AuditAction.UPDATE, "settings", "club_settings",
        auth.get('user_id'), auth.get('username'),
        f"Vereinsstammdaten aktualisiert: {', '.join(update_data.keys())}",
        request.client.host if request.client else None
    )
    
    return {"message": "Vereinsstammdaten gespeichert"}

@api_router.get("/branding")
async def get_branding():
    """Öffentlicher Branding-Endpoint (kein Auth nötig, z.B. für Login-Seite)"""
    settings = await db.settings.find_one({"key": "club_settings"}, {"_id": 0})
    club_name = settings.get("club_name") if settings else None
    logo_exists = any(f.startswith("club_logo.") for f in os.listdir(LOGO_DIR)) if os.path.exists(LOGO_DIR) else False
    return {
        "club_name": club_name or "SAU-INDEX",
        "has_logo": logo_exists,
    }

@api_router.post("/club-settings/logo")
async def upload_club_logo(file: UploadFile = File(...), request: Request = None, auth=Depends(require_admin_or_spiess)):
    """Vereinslogo hochladen"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Nur Bilddateien erlaubt (PNG, JPG)")
    
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    if ext not in ["png", "jpg", "jpeg", "webp"]:
        raise HTTPException(status_code=400, detail="Nur PNG, JPG oder WebP erlaubt")
    
    # Alte Logos löschen
    for f in os.listdir(LOGO_DIR):
        if f.startswith("club_logo."):
            os.remove(os.path.join(LOGO_DIR, f))
    
    logo_path = os.path.join(LOGO_DIR, f"club_logo.{ext}")
    
    # Komprimieren mit Pillow
    try:
        from PIL import Image
        import io
        content = await file.read()
        img = Image.open(io.BytesIO(content))
        img.thumbnail((512, 512))
        if img.mode == 'RGBA' and ext in ['jpg', 'jpeg']:
            img = img.convert('RGB')
        img.save(logo_path, quality=85, optimize=True)
    except Exception:
        # Fallback: direkt speichern
        content = await file.read() if not content else content
        with open(logo_path, "wb") as f:
            f.write(content)
    
    await log_audit(
        AuditAction.UPDATE, "settings", "club_logo",
        auth.get('user_id'), auth.get('username'),
        "Vereinslogo aktualisiert",
        request.client.host if request and request.client else None
    )
    
    return {"message": "Logo gespeichert"}

@api_router.delete("/club-settings/logo")
async def delete_club_logo(request: Request, auth=Depends(require_admin_or_spiess)):
    """Vereinslogo löschen"""
    for f in os.listdir(LOGO_DIR):
        if f.startswith("club_logo."):
            os.remove(os.path.join(LOGO_DIR, f))
    
    await log_audit(
        AuditAction.UPDATE, "settings", "club_logo",
        auth.get('user_id'), auth.get('username'),
        "Vereinslogo entfernt",
        request.client.host if request and request.client else None
    )
    return {"message": "Logo entfernt"}

@api_router.get("/club-settings/logo")
async def get_club_logo():
    """Vereinslogo abrufen (öffentlich)"""
    for f in os.listdir(LOGO_DIR):
        if f.startswith("club_logo."):
            return FileResponse(os.path.join(LOGO_DIR, f))
    raise HTTPException(status_code=404, detail="Kein Logo vorhanden")


@api_router.post("/settings/ics/sync")
async def manual_ics_sync(request: Request, auth=Depends(require_admin)):
    """Manuelle ICS-Synchronisation (nur Admin)"""
    result = await _sync_ics_calendar()
    
    await log_audit(
        AuditAction.UPDATE, "settings", "ics_sync",
        auth.get('user_id'), auth.get('username'),
        f"ICS-Sync: {result}",
        request.client.host if request.client else None
    )
    
    return result

@api_router.put("/events/{event_id}/fine-toggle")
async def toggle_event_fine(event_id: str, request: Request, input: Optional[EventFineAssign] = None, auth=Depends(require_any_role)):
    """Straflogik für einen Termin aktivieren (mit Strafenart) oder deaktivieren"""
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Termin nicht gefunden")
    
    currently_enabled = event.get('fine_enabled', False)
    
    if currently_enabled:
        # Deaktivieren
        await db.events.update_one({"id": event_id}, {"$set": {
            "fine_enabled": False,
            "fine_type_id": None,
            "fine_amount": 0
        }})
        msg = "Straflogik deaktiviert"
        new_state = False
    else:
        # Aktivieren - Strafenart muss angegeben werden
        if not input or not input.fine_type_id:
            raise HTTPException(status_code=400, detail="Strafenart muss angegeben werden")
        
        fine_type = await db.fine_types.find_one({"id": input.fine_type_id}, {"_id": 0})
        if not fine_type:
            raise HTTPException(status_code=404, detail="Strafenart nicht gefunden")
        
        await db.events.update_one({"id": event_id}, {"$set": {
            "fine_enabled": True,
            "fine_type_id": input.fine_type_id,
            "fine_amount": fine_type.get('amount', 0)
        }})
        msg = f"Straflogik aktiviert: {fine_type['label']} ({fine_type.get('amount', 0)}€)"
        new_state = True
    
    await log_audit(
        AuditAction.UPDATE, "event", event_id,
        auth.get('user_id'), auth.get('username'),
        f"{msg} für: {event['title']}",
        request.client.host if request.client else None
    )
    
    return {"message": msg, "fine_enabled": new_state}

# ============================================================
# PROFIL-ENDPOINTS
# ============================================================

@api_router.get("/profile")
async def get_profile(auth=Depends(verify_token)):
    user = await db.users.find_one({"id": auth["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    profile = {
        "username": user["username"],
        "role": user["role"],
        "firstName": None,
        "lastName": None,
        "birthday": None,
        "joinDate": None,
        "joinDateCorps": None,
        "street": None,
        "zipCode": None,
        "city": None,
        "confession": None,
        "email": None,
        "status": None,
        "avatar_path": None,
    }
    
    if user.get("member_id"):
        member = await db.members.find_one({"id": user["member_id"]}, {"_id": 0})
        if member:
            profile["firstName"] = member.get("firstName")
            profile["lastName"] = member.get("lastName")
            profile["birthday"] = member.get("birthday")
            profile["joinDate"] = member.get("joinDate")
            profile["joinDateCorps"] = member.get("joinDateCorps")
            profile["street"] = member.get("street")
            profile["zipCode"] = member.get("zipCode")
            profile["city"] = member.get("city")
            profile["confession"] = member.get("confession")
            profile["email"] = member.get("email")
            profile["status"] = member.get("status")
            profile["avatar_path"] = member.get("avatar_path")
            profile["member_id"] = member["id"]
    
    return profile

@api_router.put("/profile")
async def update_profile(data: ProfileUpdate, request: Request, auth=Depends(verify_token)):
    user = await db.users.find_one({"id": auth["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    if not user.get("member_id"):
        raise HTTPException(status_code=400, detail="Kein Mitgliedsprofil verknüpft")
    
    update = {}
    if data.firstName is not None:
        update["firstName"] = data.firstName.strip()
    if data.lastName is not None:
        update["lastName"] = data.lastName.strip()
    if data.birthday is not None:
        update["birthday"] = data.birthday if data.birthday else None
    if data.joinDate is not None:
        update["joinDate"] = data.joinDate if data.joinDate else None
    if data.joinDateCorps is not None:
        update["joinDateCorps"] = data.joinDateCorps if data.joinDateCorps else None
    if data.street is not None:
        update["street"] = data.street.strip()
    if data.zipCode is not None:
        update["zipCode"] = data.zipCode.strip()
    if data.city is not None:
        update["city"] = data.city.strip()
    if data.confession is not None:
        update["confession"] = data.confession if data.confession else None
    if data.email is not None:
        update["email"] = data.email.strip()
    
    if update:
        await db.members.update_one({"id": user["member_id"]}, {"$set": update})
        await log_audit(
            AuditAction.UPDATE, "profile", user["member_id"],
            auth.get("sub"), auth.get("username"),
            f"Profil aktualisiert: {', '.join(update.keys())}",
            request.client.host if request.client else None
        )
    
    return {"message": "Profil aktualisiert"}

@api_router.post("/profile/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...), auth=Depends(verify_token)):
    user = await db.users.find_one({"id": auth["sub"]}, {"_id": 0})
    if not user or not user.get("member_id"):
        raise HTTPException(status_code=400, detail="Kein Mitgliedsprofil verknüpft")
    
    # MIME-Type Prüfung (Client-Header)
    if file.content_type not in AVATAR_ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail="Nur JPG und PNG Dateien sind erlaubt")
    
    data = await file.read()
    
    # Dateigröße prüfen
    if len(data) > AVATAR_MAX_SIZE:
        raise HTTPException(status_code=400, detail="Maximale Dateigröße: 5 MB")
    
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Leere Datei")
    
    # Magic-Bytes Validierung (tatsächlicher Inhalt)
    try:
        detected_mime = _validate_image_bytes(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Bild komprimieren und skalieren
    try:
        compressed_data, final_mime = _compress_avatar(data, detected_mime)
    except Exception as e:
        logger.error(f"Bildkomprimierung fehlgeschlagen: {e}")
        raise HTTPException(status_code=400, detail="Bild konnte nicht verarbeitet werden. Bitte ein gültiges JPG oder PNG hochladen.")
    
    path = _save_avatar(user['member_id'], compressed_data)
    
    await db.members.update_one(
        {"id": user["member_id"]},
        {"$set": {"avatar_path": path}}
    )
    
    await log_audit(
        AuditAction.UPDATE, "profile", user["member_id"],
        auth.get("sub"), auth.get("username"),
        "Profilbild hochgeladen",
        request.client.host if request.client else None
    )
    
    return {"message": "Profilbild hochgeladen", "avatar_path": path}

@api_router.get("/profile/avatar/{path:path}")
async def get_avatar(path: str, auth: str = None):
    try:
        data, content_type = _load_avatar(path)
        return Response(content=data, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")

# Health Check Endpoint (für Docker und Monitoring)
@app.get("/health")
async def health_check():
    """Health check endpoint für Docker und Load Balancer"""
    try:
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
        
        # Indizes für Brute-Force-Schutz
        await db.login_attempts.create_index("timestamp", expireAfterSeconds=3600)
        await db.login_attempts.create_index([("username", 1), ("timestamp", -1)])
        await db.login_attempts.create_index([("ip_address", 1), ("timestamp", -1)])
        await db.account_lockouts.create_index("locked_until", expireAfterSeconds=0)
        await db.account_lockouts.create_index("username")
        await db.account_lockouts.create_index("ip_address")
        
        # Performance-Indizes für häufige Abfragen
        await db.users.create_index("username", unique=True)
        await db.users.create_index("id", unique=True)
        await db.users.create_index("member_id")
        await db.members.create_index("id", unique=True)
        await db.members.create_index("status")
        await db.fines.create_index("id", unique=True)
        await db.fines.create_index([("fiscal_year", 1), ("member_id", 1)])
        await db.fines.create_index("member_id")
        await db.fines.create_index([("date", -1)])
        await db.fine_types.create_index("id", unique=True)
        await db.audit_logs.create_index([("timestamp", -1)])
        await db.audit_logs.create_index("action")
        
        # Event-Indizes
        await db.events.create_index("id", unique=True)
        await db.events.create_index([("date", 1)])
        await db.events.create_index("fines_processed")
        await db.events.create_index("source")
        await db.events.create_index("ics_uid")
        await db.event_responses.create_index([("event_id", 1), ("member_id", 1)], unique=True)
        await db.event_responses.create_index("event_id")
        logger.info("Datenbank-Indizes erstellt")
        
        # Vereinsstammdaten laden (Geschäftsjahr-Startmonat)
        club_settings = await db.settings.find_one({"key": "club_settings"}, {"_id": 0})
        if club_settings and club_settings.get("fiscal_year_start_month"):
            global FISCAL_YEAR_START_MONTH
            FISCAL_YEAR_START_MONTH = club_settings["fiscal_year_start_month"]
            logger.info(f"Geschäftsjahr-Startmonat aus DB geladen: {FISCAL_YEAR_START_MONTH}")
        
        logger.info(f"Avatar-Speicherung: {AVATAR_DIR}")
        
        # Tägliche ICS-Synchronisation im Hintergrund starten
        asyncio.create_task(_daily_ics_sync())
        
    except Exception as e:
        logger.error(f"Fehler bei der Initialisierung: {e}")

async def _daily_ics_sync():
    """Tägliche ICS-Kalender-Synchronisation"""
    while True:
        try:
            await asyncio.sleep(5)  # Kurz warten nach Startup
            result = await _sync_ics_calendar()
            if 'error' not in result:
                logger.info(f"Tägliche ICS-Sync: {result}")
            else:
                logger.warning(f"ICS-Sync Fehler: {result}")
        except Exception as e:
            logger.error(f"ICS-Sync Task Fehler: {e}")
        await asyncio.sleep(86400)  # 24 Stunden warten

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()