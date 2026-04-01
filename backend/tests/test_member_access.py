"""
Test Member Access Management - Unified Members + Users
Tests for:
- GET /api/members returns members with user_info field
- POST /api/members/{id}/access creates user for member (enable app access)
- POST /api/members/{id}/access rejects duplicate usernames
- POST /api/members/{id}/access rejects weak passwords
- POST /api/members/{id}/access rejects admin role assignment
- DELETE /api/members/{id}/access removes user for member (disable app access)
- PUT /api/members/{id}/access updates username/role/password of linked user
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture
def test_member(auth_headers):
    """Create a test member and clean up after test"""
    unique_id = str(uuid.uuid4())[:8]
    member_data = {
        "firstName": f"TEST_{unique_id}",
        "lastName": "AccessTest",
        "status": "aktiv"
    }
    response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create test member: {response.text}"
    member = response.json()
    
    yield member
    
    # Cleanup: disable access first if exists, then delete member
    requests.delete(f"{BASE_URL}/api/members/{member['id']}/access", headers=auth_headers)
    # Archive first (required before delete)
    requests.put(f"{BASE_URL}/api/members/{member['id']}", 
                 json={"firstName": member_data["firstName"], "lastName": member_data["lastName"], "status": "archiviert"},
                 headers=auth_headers)
    requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=auth_headers)


class TestGetMembersWithUserInfo:
    """Test GET /api/members returns user_info field"""
    
    def test_members_list_includes_user_info_field(self, auth_headers):
        """GET /api/members should return members with user_info field (null or object)"""
        response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert response.status_code == 200
        members = response.json()
        assert isinstance(members, list)
        
        # Check that each member has user_info field
        for member in members:
            assert "user_info" in member, f"Member {member.get('id')} missing user_info field"
            # user_info should be None or dict with username, role, user_id
            if member["user_info"] is not None:
                assert "username" in member["user_info"]
                assert "role" in member["user_info"]
                assert "user_id" in member["user_info"]
        print(f"PASSED: GET /api/members returns {len(members)} members with user_info field")


class TestEnableMemberAccess:
    """Test POST /api/members/{id}/access - enable app access"""
    
    def test_enable_access_creates_user(self, auth_headers, test_member):
        """POST /api/members/{id}/access creates a user for the member"""
        unique_id = str(uuid.uuid4())[:8]
        access_data = {
            "username": f"testuser_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to enable access: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert data["message"] == "App-Zugang aktiviert"
        
        # Verify member now has user_info
        members_response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        members = members_response.json()
        member = next((m for m in members if m["id"] == test_member["id"]), None)
        assert member is not None
        assert member["user_info"] is not None
        assert member["user_info"]["username"] == access_data["username"]
        assert member["user_info"]["role"] == access_data["role"]
        print(f"PASSED: Enable access creates user with username={access_data['username']}")
    
    def test_enable_access_rejects_duplicate_username(self, auth_headers, test_member):
        """POST /api/members/{id}/access rejects duplicate usernames"""
        unique_id = str(uuid.uuid4())[:8]
        access_data = {
            "username": f"testuser_dup_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        # First enable access
        response1 = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Create another member
        member2_data = {
            "firstName": f"TEST_{unique_id}_2",
            "lastName": "DupTest",
            "status": "aktiv"
        }
        member2_response = requests.post(f"{BASE_URL}/api/members", json=member2_data, headers=auth_headers)
        member2 = member2_response.json()
        
        try:
            # Try to use same username
            response2 = requests.post(
                f"{BASE_URL}/api/members/{member2['id']}/access",
                json=access_data,
                headers=auth_headers
            )
            assert response2.status_code == 400, f"Expected 400, got {response2.status_code}"
            assert "existiert bereits" in response2.json().get("detail", "")
            print("PASSED: Duplicate username rejected with 400")
        finally:
            # Cleanup member2
            requests.put(f"{BASE_URL}/api/members/{member2['id']}", 
                        json={"firstName": member2_data["firstName"], "lastName": member2_data["lastName"], "status": "archiviert"},
                        headers=auth_headers)
            requests.delete(f"{BASE_URL}/api/members/{member2['id']}", headers=auth_headers)
    
    def test_enable_access_rejects_weak_password_short(self, auth_headers, test_member):
        """POST /api/members/{id}/access rejects passwords less than 8 chars"""
        access_data = {
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "password": "Short1",  # Only 6 chars
            "role": "mitglied"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "8 Zeichen" in response.json().get("detail", "")
        print("PASSED: Short password (<8 chars) rejected")
    
    def test_enable_access_rejects_weak_password_no_number(self, auth_headers, test_member):
        """POST /api/members/{id}/access rejects passwords without numbers"""
        access_data = {
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "password": "NoNumberHere",  # No number
            "role": "mitglied"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Zahl" in response.json().get("detail", "")
        print("PASSED: Password without number rejected")
    
    def test_enable_access_rejects_admin_role(self, auth_headers, test_member):
        """POST /api/members/{id}/access rejects admin role assignment"""
        access_data = {
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "password": "TestPass123",
            "role": "admin"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Admin" in response.json().get("detail", "")
        print("PASSED: Admin role assignment rejected")
    
    def test_enable_access_accepts_spiess_role(self, auth_headers, test_member):
        """POST /api/members/{id}/access accepts spiess role"""
        unique_id = str(uuid.uuid4())[:8]
        access_data = {
            "username": f"spiess_{unique_id}",
            "password": "TestPass123",
            "role": "spiess"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASSED: Spiess role accepted")
    
    def test_enable_access_accepts_vorstand_role(self, auth_headers, test_member):
        """POST /api/members/{id}/access accepts vorstand role"""
        unique_id = str(uuid.uuid4())[:8]
        access_data = {
            "username": f"vorstand_{unique_id}",
            "password": "TestPass123",
            "role": "vorstand"
        }
        response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("PASSED: Vorstand role accepted")


class TestDisableMemberAccess:
    """Test DELETE /api/members/{id}/access - disable app access"""
    
    def test_disable_access_removes_user(self, auth_headers, test_member):
        """DELETE /api/members/{id}/access removes user for member"""
        unique_id = str(uuid.uuid4())[:8]
        # First enable access
        access_data = {
            "username": f"todelete_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        enable_response = requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        assert enable_response.status_code == 200
        
        # Now disable access
        disable_response = requests.delete(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            headers=auth_headers
        )
        assert disable_response.status_code == 200
        assert disable_response.json()["message"] == "App-Zugang deaktiviert"
        
        # Verify member no longer has user_info
        members_response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        members = members_response.json()
        member = next((m for m in members if m["id"] == test_member["id"]), None)
        assert member is not None
        assert member["user_info"] is None
        print("PASSED: Disable access removes user")
    
    def test_disable_access_returns_404_if_no_access(self, auth_headers, test_member):
        """DELETE /api/members/{id}/access returns 404 if no access exists"""
        response = requests.delete(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("PASSED: Disable access returns 404 when no access exists")


class TestUpdateMemberAccess:
    """Test PUT /api/members/{id}/access - update user access"""
    
    def test_update_access_changes_username(self, auth_headers, test_member):
        """PUT /api/members/{id}/access updates username"""
        unique_id = str(uuid.uuid4())[:8]
        # First enable access
        access_data = {
            "username": f"original_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        
        # Update username
        new_username = f"updated_{unique_id}"
        update_response = requests.put(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json={"username": new_username},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify change
        members_response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        members = members_response.json()
        member = next((m for m in members if m["id"] == test_member["id"]), None)
        assert member["user_info"]["username"] == new_username
        print(f"PASSED: Username updated to {new_username}")
    
    def test_update_access_changes_role(self, auth_headers, test_member):
        """PUT /api/members/{id}/access updates role"""
        unique_id = str(uuid.uuid4())[:8]
        # First enable access as mitglied
        access_data = {
            "username": f"roletest_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        
        # Update role to vorstand
        update_response = requests.put(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json={"role": "vorstand"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify change
        members_response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        members = members_response.json()
        member = next((m for m in members if m["id"] == test_member["id"]), None)
        assert member["user_info"]["role"] == "vorstand"
        print("PASSED: Role updated to vorstand")
    
    def test_update_access_rejects_admin_role(self, auth_headers, test_member):
        """PUT /api/members/{id}/access rejects admin role"""
        unique_id = str(uuid.uuid4())[:8]
        # First enable access
        access_data = {
            "username": f"noadmin_{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        
        # Try to update to admin
        update_response = requests.put(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json={"role": "admin"},
            headers=auth_headers
        )
        assert update_response.status_code == 400
        assert "Admin" in update_response.json().get("detail", "")
        print("PASSED: Admin role update rejected")
    
    def test_update_access_changes_password(self, auth_headers, test_member):
        """PUT /api/members/{id}/access updates password"""
        unique_id = str(uuid.uuid4())[:8]
        username = f"pwtest_{unique_id}"
        # First enable access
        access_data = {
            "username": username,
            "password": "OldPass123",
            "role": "mitglied"
        }
        requests.post(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json=access_data,
            headers=auth_headers
        )
        
        # Update password
        new_password = "NewPass456"
        update_response = requests.put(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json={"password": new_password},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify new password works by logging in
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": username,
            "password": new_password
        })
        assert login_response.status_code == 200, f"Login with new password failed: {login_response.text}"
        print("PASSED: Password updated and login works")
    
    def test_update_access_returns_404_if_no_access(self, auth_headers, test_member):
        """PUT /api/members/{id}/access returns 404 if no access exists"""
        response = requests.put(
            f"{BASE_URL}/api/members/{test_member['id']}/access",
            json={"username": "newname"},
            headers=auth_headers
        )
        assert response.status_code == 404
        print("PASSED: Update access returns 404 when no access exists")


class TestUsersRouteRedirect:
    """Test that /users route redirects to /members"""
    
    def test_users_api_still_works(self, auth_headers):
        """GET /api/users still returns users list (for admin)"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        # Admin user should exist
        admin_user = next((u for u in users if u["username"] == "admin"), None)
        assert admin_user is not None
        assert admin_user["role"] == "admin"
        print(f"PASSED: GET /api/users returns {len(users)} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
