"""
Avatar Upload Tests for Profile Page
Tests: MIME validation, file size limits, magic bytes validation, compression, retrieval
"""
import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HENRIK_CREDENTIALS = {"username": "Henrik", "password": "Henrik123!"}  # vorstand with member_id
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}  # admin without member_id


@pytest.fixture(scope="module")
def henrik_token():
    """Get token for Henrik (vorstand with member_id)"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=HENRIK_CREDENTIALS, timeout=30)
    if resp.status_code == 200:
        return resp.json()["token"]
    pytest.skip(f"Henrik login failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get token for admin (no member_id)"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS, timeout=30)
    if resp.status_code == 200:
        return resp.json()["token"]
    pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")


def create_test_image(format_type: str, width: int = 100, height: int = 100) -> bytes:
    """Create a test image in specified format"""
    img = Image.new('RGB', (width, height), color='red')
    buf = io.BytesIO()
    if format_type.upper() == 'JPEG':
        img.save(buf, format='JPEG', quality=85)
    elif format_type.upper() == 'PNG':
        img.save(buf, format='PNG')
    elif format_type.upper() == 'GIF':
        img.save(buf, format='GIF')
    elif format_type.upper() == 'WEBP':
        img.save(buf, format='WEBP')
    return buf.getvalue()


def create_spoofed_image() -> bytes:
    """Create a GIF image that will be sent with JPEG content-type (spoofed MIME)"""
    img = Image.new('RGB', (100, 100), color='blue')
    buf = io.BytesIO()
    img.save(buf, format='GIF')
    return buf.getvalue()


def create_large_image(size_mb: float = 6) -> bytes:
    """Create a large image exceeding 5MB limit"""
    # Create a large image by making it very large dimensions
    # 6MB ~ 1500x1500 RGB uncompressed, but JPEG compresses well
    # So we create a larger image with noise to prevent compression
    import random
    width = 3000
    height = 3000
    img = Image.new('RGB', (width, height))
    # Fill with random pixels to prevent compression
    pixels = img.load()
    for i in range(width):
        for j in range(height):
            pixels[i, j] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')  # PNG doesn't compress as much
    return buf.getvalue()


class TestAvatarUploadValidFormats:
    """Test avatar upload with valid file formats"""

    def test_upload_valid_jpeg(self, henrik_token):
        """Avatar upload with valid JPG file should succeed"""
        jpeg_data = create_test_image('JPEG')
        files = {'file': ('test.jpg', jpeg_data, 'image/jpeg')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "avatar_path" in data, "Response should contain avatar_path"
        assert data["avatar_path"].endswith(".jpg"), "Avatar should be saved as JPEG"
        print(f"✓ JPEG upload successful, path: {data['avatar_path']}")

    def test_upload_valid_png(self, henrik_token):
        """Avatar upload with valid PNG file should succeed"""
        png_data = create_test_image('PNG')
        files = {'file': ('test.png', png_data, 'image/png')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "avatar_path" in data, "Response should contain avatar_path"
        # PNG is converted to JPEG after compression
        assert data["avatar_path"].endswith(".jpg"), "Avatar should be converted to JPEG"
        print(f"✓ PNG upload successful (converted to JPEG), path: {data['avatar_path']}")


class TestAvatarUploadInvalidFormats:
    """Test avatar upload rejection for invalid formats"""

    def test_reject_webp_client_mime(self, henrik_token):
        """Avatar upload with WebP should be rejected (client MIME check)"""
        webp_data = create_test_image('WEBP')
        files = {'file': ('test.webp', webp_data, 'image/webp')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "JPG" in resp.text or "PNG" in resp.text or "erlaubt" in resp.text
        print(f"✓ WebP correctly rejected: {resp.json().get('detail', resp.text)}")

    def test_reject_gif_client_mime(self, henrik_token):
        """Avatar upload with GIF should be rejected (client MIME check)"""
        gif_data = create_test_image('GIF')
        files = {'file': ('test.gif', gif_data, 'image/gif')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "JPG" in resp.text or "PNG" in resp.text or "erlaubt" in resp.text
        print(f"✓ GIF correctly rejected: {resp.json().get('detail', resp.text)}")

    def test_reject_spoofed_mime_magic_bytes(self, henrik_token):
        """Avatar upload with spoofed MIME (claiming JPEG but actually GIF) should be rejected via magic bytes"""
        # Create a GIF but send it with image/jpeg content-type
        gif_data = create_test_image('GIF')
        files = {'file': ('fake.jpg', gif_data, 'image/jpeg')}  # Spoofed MIME
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 400, f"Expected 400 for spoofed MIME, got {resp.status_code}: {resp.text}"
        detail = resp.json().get('detail', '')
        assert "Ungültiges Bildformat" in detail or "JPG" in detail or "PNG" in detail
        print(f"✓ Spoofed MIME correctly rejected via magic bytes: {detail}")


class TestAvatarUploadSizeLimits:
    """Test avatar upload file size validation"""

    def test_reject_file_over_5mb(self, henrik_token):
        """Avatar upload >5MB should be rejected"""
        # Create a file that's definitely over 5MB
        large_data = b'x' * (6 * 1024 * 1024)  # 6MB of data
        files = {'file': ('large.jpg', large_data, 'image/jpeg')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=120)
        
        assert resp.status_code == 400, f"Expected 400 for >5MB file, got {resp.status_code}: {resp.text}"
        detail = resp.json().get('detail', '')
        assert "5 MB" in detail or "Dateigröße" in detail or "Ungültiges" in detail
        print(f"✓ Large file correctly rejected: {detail}")

    def test_reject_empty_file(self, henrik_token):
        """Avatar upload of 0-byte file should be rejected"""
        files = {'file': ('empty.jpg', b'', 'image/jpeg')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 400, f"Expected 400 for empty file, got {resp.status_code}: {resp.text}"
        detail = resp.json().get('detail', '')
        assert "Leere" in detail or "leer" in detail.lower() or "Ungültiges" in detail
        print(f"✓ Empty file correctly rejected: {detail}")


class TestAvatarCompression:
    """Test avatar compression and resizing"""

    def test_large_image_compressed_to_512px(self, henrik_token):
        """Uploaded avatar should be compressed/resized to max 512px dimension"""
        # Create a large 1000x1000 image
        large_img = create_test_image('JPEG', width=1000, height=1000)
        files = {'file': ('large.jpg', large_img, 'image/jpeg')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        avatar_path = resp.json().get('avatar_path')
        assert avatar_path, "Should return avatar_path"
        
        # Retrieve the avatar and check dimensions
        get_resp = requests.get(f"{BASE_URL}/api/profile/avatar/{avatar_path}", headers=headers, timeout=60)
        assert get_resp.status_code == 200, f"Failed to retrieve avatar: {get_resp.status_code}"
        
        # Check the image dimensions
        retrieved_img = Image.open(io.BytesIO(get_resp.content))
        max_dim = max(retrieved_img.width, retrieved_img.height)
        assert max_dim <= 512, f"Image should be resized to max 512px, got {max_dim}px"
        print(f"✓ Large image compressed to {retrieved_img.width}x{retrieved_img.height}")


class TestAvatarRetrieval:
    """Test avatar retrieval endpoint"""

    def test_retrieve_uploaded_avatar(self, henrik_token):
        """Uploaded avatar can be retrieved via GET /api/profile/avatar/{path}"""
        # First upload an avatar
        jpeg_data = create_test_image('JPEG', width=200, height=200)
        files = {'file': ('test.jpg', jpeg_data, 'image/jpeg')}
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        upload_resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        
        avatar_path = upload_resp.json().get('avatar_path')
        assert avatar_path, "Should return avatar_path"
        
        # Retrieve the avatar
        get_resp = requests.get(f"{BASE_URL}/api/profile/avatar/{avatar_path}", headers=headers, timeout=60)
        
        assert get_resp.status_code == 200, f"Expected 200, got {get_resp.status_code}: {get_resp.text}"
        assert len(get_resp.content) > 0, "Retrieved avatar should have content"
        assert get_resp.headers.get('content-type', '').startswith('image/'), "Should return image content-type"
        print(f"✓ Avatar retrieved successfully, size: {len(get_resp.content)} bytes")


class TestAvatarNoMemberProfile:
    """Test avatar upload for users without member profile"""

    def test_admin_upload_rejected_no_member(self, admin_token):
        """Admin without member_id should get 'Kein Mitgliedsprofil verknüpft' error"""
        jpeg_data = create_test_image('JPEG')
        files = {'file': ('test.jpg', jpeg_data, 'image/jpeg')}
        headers = {'Authorization': f'Bearer {admin_token}'}
        
        resp = requests.post(f"{BASE_URL}/api/profile/avatar", files=files, headers=headers, timeout=60)
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        detail = resp.json().get('detail', '')
        assert "Mitgliedsprofil" in detail or "verknüpft" in detail
        print(f"✓ Admin upload correctly rejected: {detail}")


class TestProfileEndpoints:
    """Test profile page related endpoints"""

    def test_profile_loads_with_avatar(self, henrik_token):
        """Profile page loads correctly with avatar, form fields, and account info"""
        headers = {'Authorization': f'Bearer {henrik_token}'}
        
        resp = requests.get(f"{BASE_URL}/api/profile", headers=headers, timeout=30)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Check required fields
        assert "username" in data, "Profile should have username"
        assert "role" in data, "Profile should have role"
        assert "firstName" in data, "Profile should have firstName"
        assert "lastName" in data, "Profile should have lastName"
        assert "birthday" in data, "Profile should have birthday field"
        assert "avatar_path" in data, "Profile should have avatar_path field"
        
        print(f"✓ Profile loaded: {data['username']} ({data['role']})")
        print(f"  Name: {data['firstName']} {data['lastName']}")
        print(f"  Avatar: {data.get('avatar_path', 'None')}")

    def test_profile_save_name_birthday(self, henrik_token):
        """Profile save (name/birthday) works correctly"""
        headers = {'Authorization': f'Bearer {henrik_token}', 'Content-Type': 'application/json'}
        
        # First get current profile
        get_resp = requests.get(f"{BASE_URL}/api/profile", headers=headers, timeout=30)
        assert get_resp.status_code == 200
        original = get_resp.json()
        
        # Update profile
        update_data = {
            "firstName": "Henrik",
            "lastName": "Test",
            "birthday": "1990-05-15"
        }
        put_resp = requests.put(f"{BASE_URL}/api/profile", json=update_data, headers=headers, timeout=30)
        
        assert put_resp.status_code == 200, f"Expected 200, got {put_resp.status_code}: {put_resp.text}"
        
        # Verify changes persisted
        verify_resp = requests.get(f"{BASE_URL}/api/profile", headers=headers, timeout=30)
        assert verify_resp.status_code == 200
        updated = verify_resp.json()
        
        assert updated["firstName"] == "Henrik", f"firstName not updated: {updated['firstName']}"
        assert updated["lastName"] == "Test", f"lastName not updated: {updated['lastName']}"
        assert updated["birthday"] == "1990-05-15", f"birthday not updated: {updated['birthday']}"
        
        # Restore original values
        restore_data = {
            "firstName": original.get("firstName", "Henrik"),
            "lastName": original.get("lastName", ""),
            "birthday": original.get("birthday", "")
        }
        requests.put(f"{BASE_URL}/api/profile", json=restore_data, headers=headers, timeout=30)
        
        print(f"✓ Profile save works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
