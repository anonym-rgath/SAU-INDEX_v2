"""
Backend Tests for Spieß Member Linking Feature
- Test creating/updating spiess users with member_id
- Test that spiess with member_id can access personal statistics
- Test that spiess without member_id gets empty personal statistics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fines-tracker-1.preview.emergentagent.com').rstrip('/')


class TestSpiessUserWithMemberLink:
    """Tests for Spieß user with linked member functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin headers"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def available_member_id(self, admin_headers):
        """Get an available member without existing user account"""
        # Get all members
        members_res = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        assert members_res.status_code == 200
        members = members_res.json()
        
        # Get all users
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        assert users_res.status_code == 200
        users = users_res.json()
        
        # Find members not linked to any user and not archived
        used_member_ids = {u.get('member_id') for u in users if u.get('member_id')}
        available = [m for m in members if m['id'] not in used_member_ids and m.get('status') != 'archiviert']
        
        assert len(available) > 0, "No available members without user accounts"
        return available[0]['id']
    
    def test_01_create_spiess_without_member_id(self, admin_headers):
        """Test creating a spiess user without member_id (allowed - optional)"""
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_no_member",
            "password": "test123",
            "role": "spiess"
            # No member_id - should be allowed for spiess
        })
        
        assert response.status_code in [200, 201], f"Failed to create spiess: {response.text}"
        data = response.json()
        assert data["role"] == "spiess"
        assert data.get("member_id") is None, "member_id should be None when not provided"
        print(f"SUCCESS: Created spiess user without member_id: {data['username']}")
    
    def test_02_create_spiess_with_member_id(self, admin_headers, available_member_id):
        """Test creating a spiess user with member_id (allowed - optional)"""
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_with_member",
            "password": "test123",
            "role": "spiess",
            "member_id": available_member_id
        })
        
        assert response.status_code in [200, 201], f"Failed to create spiess with member: {response.text}"
        data = response.json()
        assert data["role"] == "spiess"
        assert data["member_id"] == available_member_id, "member_id should be set"
        print(f"SUCCESS: Created spiess user with member_id: {data['username']}")
    
    def test_03_update_spiess_add_member_id(self, admin_headers):
        """Test updating existing spiess to add member_id (Henrik user)"""
        # First get Henrik's user ID
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_res.json()
        henrik = next((u for u in users if u['username'] == 'Henrik'), None)
        
        assert henrik is not None, "Henrik user not found"
        assert henrik.get('member_id') is None, "Henrik should not have member_id initially"
        
        # Get available member (Robin Gathmann)
        members_res = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        members = members_res.json()
        robin = next((m for m in members if m.get('firstName') == 'Robin' and m.get('lastName') == 'Gathmann'), None)
        
        if robin:
            # Update Henrik with Robin's member_id
            response = requests.put(f"{BASE_URL}/api/users/{henrik['id']}", headers=admin_headers, json={
                "username": "Henrik",
                "role": "spiess",
                "member_id": robin['id']
            })
            
            assert response.status_code == 200, f"Failed to update Henrik: {response.text}"
            data = response.json()
            assert data["member_id"] == robin['id'], "member_id should be set after update"
            print(f"SUCCESS: Updated Henrik with member_id: {robin['id']}")
            
            # Revert to test other scenarios
            requests.put(f"{BASE_URL}/api/users/{henrik['id']}", headers=admin_headers, json={
                "username": "Henrik",
                "role": "spiess",
                "member_id": ""  # Remove member_id
            })
        else:
            pytest.skip("Robin Gathmann member not found")
    
    def test_04_spiess_login_returns_member_id(self, admin_headers):
        """Test that spiess login returns member_id when linked"""
        # Create a spiess with member
        members_res = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        members = members_res.json()
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_res.json()
        
        used_member_ids = {u.get('member_id') for u in users if u.get('member_id')}
        available = [m for m in members if m['id'] not in used_member_ids and m.get('status') != 'archiviert']
        
        if not available:
            pytest.skip("No available members")
        
        member_id = available[0]['id']
        
        # Create test spiess with member
        create_res = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_login_test",
            "password": "test123",
            "role": "spiess",
            "member_id": member_id
        })
        
        if create_res.status_code not in [200, 201]:
            pytest.skip(f"Could not create test user: {create_res.text}")
        
        # Login and check member_id is returned
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "TEST_spiess_login_test",
            "password": "test123"
        })
        
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        login_data = login_res.json()
        assert login_data.get("member_id") == member_id, "member_id should be returned in login response"
        print(f"SUCCESS: Login returns member_id: {login_data.get('member_id')}")
    
    def test_05_spiess_personal_statistics_with_member(self, admin_headers):
        """Test that spiess with member_id can access personal statistics"""
        # Get fiscal years
        years_res = requests.get(f"{BASE_URL}/api/fiscal-years", headers=admin_headers)
        fiscal_years = years_res.json().get('fiscal_years', ['2025/2026'])
        fiscal_year = fiscal_years[0] if fiscal_years else '2025/2026'
        
        # Login as spiess with member
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "TEST_spiess_login_test",
            "password": "test123"
        })
        
        if login_res.status_code != 200:
            pytest.skip("Spiess user not available")
        
        token = login_res.json()["token"]
        spiess_headers = {"Authorization": f"Bearer {token}"}
        
        # Access personal statistics
        stats_res = requests.get(f"{BASE_URL}/api/statistics/personal?fiscal_year={fiscal_year}", headers=spiess_headers)
        
        assert stats_res.status_code == 200, f"Failed to get personal stats: {stats_res.text}"
        stats = stats_res.json()
        assert "fiscal_year" in stats
        assert "member_name" in stats
        assert "total_fines" in stats
        assert "total_amount" in stats
        print(f"SUCCESS: Personal statistics accessible: {stats}")
    
    def test_06_spiess_without_member_personal_statistics(self, admin_headers):
        """Test that spiess without member_id gets empty/default personal statistics"""
        # Login as Henrik (spiess without member)
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "Henrik",
            "password": "test123"
        })
        
        assert login_res.status_code == 200, f"Henrik login failed: {login_res.text}"
        
        token = login_res.json()["token"]
        member_id = login_res.json().get("member_id")
        
        # Henrik should not have member_id
        assert member_id is None, f"Henrik should not have member_id, got: {member_id}"
        
        spiess_headers = {"Authorization": f"Bearer {token}"}
        
        # Access personal statistics - should return default/empty values
        stats_res = requests.get(f"{BASE_URL}/api/statistics/personal?fiscal_year=2025/2026", headers=spiess_headers)
        
        assert stats_res.status_code == 200, f"Failed to get personal stats: {stats_res.text}"
        stats = stats_res.json()
        assert stats.get("total_fines") == 0, "Total fines should be 0 for unlinked spiess"
        assert stats.get("total_amount") == 0.0, "Total amount should be 0 for unlinked spiess"
        print(f"SUCCESS: Personal stats for unlinked spiess returns empty: {stats}")
    
    def test_07_spiess_can_access_full_statistics(self, admin_headers):
        """Test that spiess can access full statistics (Admin dashboard)"""
        # Login as Henrik
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "Henrik",
            "password": "test123"
        })
        
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        spiess_headers = {"Authorization": f"Bearer {token}"}
        
        # Access full statistics
        stats_res = requests.get(f"{BASE_URL}/api/statistics?fiscal_year=2025/2026", headers=spiess_headers)
        
        assert stats_res.status_code == 200, f"Failed to get statistics: {stats_res.text}"
        stats = stats_res.json()
        assert "ranking" in stats
        assert "sau" in stats or stats.get("sau") is None  # May or may not exist
        assert "laemmchen" in stats or stats.get("laemmchen") is None
        print(f"SUCCESS: Spiess can access full statistics (Admin dashboard)")
    
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_test_users(self, admin_headers):
        """Cleanup test users after all tests"""
        yield
        
        # Get all users and delete TEST_ prefixed ones
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        if users_res.status_code == 200:
            users = users_res.json()
            for user in users:
                if user['username'].startswith('TEST_'):
                    requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=admin_headers)
                    print(f"Cleaned up test user: {user['username']}")


class TestUserManagementMemberDropdown:
    """Tests for UserManagement member dropdown visibility for spiess role"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_01_api_accepts_spiess_with_member_id(self, admin_headers):
        """Test that API accepts member_id for spiess role (backend support)"""
        # Get available member
        members_res = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        members = members_res.json()
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_res.json()
        
        used_member_ids = {u.get('member_id') for u in users if u.get('member_id')}
        available = [m for m in members if m['id'] not in used_member_ids and m.get('status') != 'archiviert']
        
        if not available:
            pytest.skip("No available members")
        
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_api_test",
            "password": "test123",
            "role": "spiess",
            "member_id": available[0]['id']
        })
        
        # Should succeed - backend supports member_id for spiess
        assert response.status_code in [200, 201], f"API should accept member_id for spiess: {response.text}"
        data = response.json()
        assert data["member_id"] == available[0]['id']
        print(f"SUCCESS: API accepts member_id for spiess role")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=admin_headers)
    
    def test_02_api_accepts_spiess_without_member_id(self, admin_headers):
        """Test that API accepts spiess without member_id (optional)"""
        response = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_no_member_api",
            "password": "test123",
            "role": "spiess"
            # No member_id
        })
        
        assert response.status_code in [200, 201], f"API should accept spiess without member_id: {response.text}"
        data = response.json()
        assert data["member_id"] is None
        print(f"SUCCESS: API accepts spiess without member_id")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{data['id']}", headers=admin_headers)
    
    def test_03_update_user_with_member_id_for_spiess(self, admin_headers):
        """Test updating user to add member_id for spiess role"""
        # Create spiess without member
        create_res = requests.post(f"{BASE_URL}/api/users", headers=admin_headers, json={
            "username": "TEST_spiess_update_test",
            "password": "test123",
            "role": "spiess"
        })
        
        assert create_res.status_code in [200, 201]
        user_id = create_res.json()["id"]
        
        # Get available member
        members_res = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        members = members_res.json()
        users_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_res.json()
        
        used_member_ids = {u.get('member_id') for u in users if u.get('member_id')}
        available = [m for m in members if m['id'] not in used_member_ids and m.get('status') != 'archiviert']
        
        if not available:
            requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)
            pytest.skip("No available members")
        
        # Update spiess with member_id
        update_res = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers, json={
            "username": "TEST_spiess_update_test",
            "role": "spiess",
            "member_id": available[0]['id']
        })
        
        assert update_res.status_code == 200, f"Failed to update spiess with member_id: {update_res.text}"
        updated_data = update_res.json()
        assert updated_data["member_id"] == available[0]['id']
        print(f"SUCCESS: Updated spiess with member_id")
        
        # Verify via GET
        get_res = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = get_res.json()
        updated_user = next((u for u in users if u['id'] == user_id), None)
        assert updated_user is not None
        assert updated_user["member_id"] == available[0]['id']
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=admin_headers)
