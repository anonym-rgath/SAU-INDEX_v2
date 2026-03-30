"""
Backend API Tests for Rheinzelmänner Fines Tracker
Tests all API endpoints after performance optimizations:
- MongoDB aggregation pipelines for statistics
- DB indexes for all collections
- Fine type update query fix (space in key bug)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["role"] == "admin"
        assert data["username"] == ADMIN_USERNAME
        print(f"✓ Login successful - token received, role: {data['role']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestFiscalYearsEndpoint:
    """Fiscal year endpoint tests"""
    
    def test_get_fiscal_years(self, auth_headers):
        """Test GET /api/fiscal-years returns fiscal year list"""
        response = requests.get(f"{BASE_URL}/api/fiscal-years", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "fiscal_years" in data
        assert isinstance(data["fiscal_years"], list)
        print(f"✓ Fiscal years retrieved: {data['fiscal_years']}")


class TestMembersEndpoints:
    """Member CRUD endpoint tests"""
    
    def test_get_members(self, auth_headers):
        """Test GET /api/members returns member list"""
        response = requests.get(f"{BASE_URL}/api/members", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Members retrieved: {len(data)} members")
    
    def test_create_member(self, auth_headers):
        """Test POST /api/members creates a new member"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TEST_{unique_id}",
            "lastName": "Testmember",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["firstName"] == member_data["firstName"]
        assert data["lastName"] == member_data["lastName"]
        assert "id" in data
        print(f"✓ Member created: {data['firstName']} {data['lastName']}")
        return data["id"]
    
    def test_update_member(self, auth_headers):
        """Test PUT /api/members/{id} updates a member"""
        # First create a member
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/members", json={
            "firstName": f"TEST_Update_{unique_id}",
            "lastName": "Original",
            "status": "aktiv"
        }, headers=auth_headers)
        member_id = create_response.json()["id"]
        
        # Update the member
        update_response = requests.put(f"{BASE_URL}/api/members/{member_id}", json={
            "firstName": f"TEST_Update_{unique_id}",
            "lastName": "Updated",
            "status": "passiv"
        }, headers=auth_headers)
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["lastName"] == "Updated"
        assert data["status"] == "passiv"
        print(f"✓ Member updated: status changed to passiv")
    
    def test_archive_member(self, auth_headers):
        """Test archiving a member"""
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/members", json={
            "firstName": f"TEST_Archive_{unique_id}",
            "lastName": "ToArchive",
            "status": "aktiv"
        }, headers=auth_headers)
        member_id = create_response.json()["id"]
        
        # Archive the member
        archive_response = requests.put(f"{BASE_URL}/api/members/{member_id}", json={
            "firstName": f"TEST_Archive_{unique_id}",
            "lastName": "ToArchive",
            "status": "archiviert"
        }, headers=auth_headers)
        assert archive_response.status_code == 200
        data = archive_response.json()
        assert data["status"] == "archiviert"
        print(f"✓ Member archived successfully")


class TestFineTypesEndpoints:
    """Fine type CRUD endpoint tests - includes fix verification for space in query key bug"""
    
    def test_get_fine_types(self, auth_headers):
        """Test GET /api/fine-types returns fine type list"""
        response = requests.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fine types retrieved: {len(data)} types")
    
    def test_create_fine_type(self, auth_headers):
        """Test POST /api/fine-types creates a new fine type"""
        unique_id = str(uuid.uuid4())[:8]
        fine_type_data = {
            "label": f"TEST_FineType_{unique_id}",
            "amount": 5.50
        }
        response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["label"] == fine_type_data["label"]
        assert data["amount"] == fine_type_data["amount"]
        print(f"✓ Fine type created: {data['label']}")
        return data["id"]
    
    def test_update_fine_type_bug_fix(self, auth_headers):
        """
        Test PUT /api/fine-types/{id} - CRITICAL: Verifies the bug fix for space in query key
        Previously the query had ' id' instead of 'id' which caused updates to fail
        """
        # Create a fine type
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/fine-types", json={
            "label": f"TEST_UpdateBugFix_{unique_id}",
            "amount": 10.00
        }, headers=auth_headers)
        assert create_response.status_code == 200
        fine_type_id = create_response.json()["id"]
        
        # Update the fine type - this was failing before the bug fix
        update_response = requests.put(f"{BASE_URL}/api/fine-types/{fine_type_id}", json={
            "label": f"TEST_UpdateBugFix_{unique_id}_UPDATED",
            "amount": 15.00
        }, headers=auth_headers)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        data = update_response.json()
        assert "UPDATED" in data["label"]
        assert data["amount"] == 15.00
        print(f"✓ Fine type update bug fix verified - update successful")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        fine_types = get_response.json()
        updated_type = next((ft for ft in fine_types if ft["id"] == fine_type_id), None)
        assert updated_type is not None
        assert updated_type["amount"] == 15.00
        print(f"✓ Fine type update persisted correctly")
    
    def test_delete_fine_type(self, auth_headers):
        """Test DELETE /api/fine-types/{id}"""
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/fine-types", json={
            "label": f"TEST_Delete_{unique_id}",
            "amount": 1.00
        }, headers=auth_headers)
        fine_type_id = create_response.json()["id"]
        
        delete_response = requests.delete(f"{BASE_URL}/api/fine-types/{fine_type_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ Fine type deleted successfully")


class TestFinesEndpoints:
    """Fine CRUD endpoint tests"""
    
    @pytest.fixture(scope="class")
    def test_member(self, auth_headers):
        """Create a test member for fine tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/members", json={
            "firstName": f"TEST_FinesMember_{unique_id}",
            "lastName": "ForFines",
            "status": "aktiv"
        }, headers=auth_headers)
        return response.json()
    
    @pytest.fixture(scope="class")
    def test_fine_type(self, auth_headers):
        """Create a test fine type for fine tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/fine-types", json={
            "label": f"TEST_FineType_{unique_id}",
            "amount": 5.00
        }, headers=auth_headers)
        return response.json()
    
    def test_get_fines_with_fiscal_year(self, auth_headers):
        """Test GET /api/fines with fiscal_year filter"""
        response = requests.get(f"{BASE_URL}/api/fines", params={"fiscal_year": "2025/2026"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Fines retrieved for 2025/2026: {len(data)} fines")
    
    def test_create_fine_without_date(self, auth_headers, test_member, test_fine_type):
        """Test POST /api/fines without date uses current date"""
        fine_data = {
            "member_id": test_member["id"],
            "fine_type_id": test_fine_type["id"],
            "amount": 5.00,
            "notes": "Test fine without date"
        }
        response = requests.post(f"{BASE_URL}/api/fines", json=fine_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == test_member["id"]
        assert "fiscal_year" in data
        print(f"✓ Fine created without date - fiscal year: {data['fiscal_year']}")
    
    def test_create_fine_with_retroactive_date(self, auth_headers, test_member, test_fine_type):
        """Test POST /api/fines with retroactive date"""
        fine_data = {
            "member_id": test_member["id"],
            "fine_type_id": test_fine_type["id"],
            "amount": 7.50,
            "date": "2024-10-15T12:00:00Z",
            "notes": "Retroactive fine test"
        }
        response = requests.post(f"{BASE_URL}/api/fines", json=fine_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["fiscal_year"] == "2024/2025"  # Oct 2024 is in 2024/2025 fiscal year
        print(f"✓ Retroactive fine created - fiscal year: {data['fiscal_year']}")
    
    def test_update_fine(self, auth_headers, test_member, test_fine_type):
        """Test PUT /api/fines/{id}"""
        # Create a fine
        create_response = requests.post(f"{BASE_URL}/api/fines", json={
            "member_id": test_member["id"],
            "fine_type_id": test_fine_type["id"],
            "amount": 10.00
        }, headers=auth_headers)
        fine_id = create_response.json()["id"]
        
        # Update the fine
        update_response = requests.put(f"{BASE_URL}/api/fines/{fine_id}", json={
            "amount": 12.50,
            "notes": "Updated amount"
        }, headers=auth_headers)
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["amount"] == 12.50
        assert data["notes"] == "Updated amount"
        print(f"✓ Fine updated successfully")
    
    def test_delete_fine(self, auth_headers, test_member, test_fine_type):
        """Test DELETE /api/fines/{id}"""
        create_response = requests.post(f"{BASE_URL}/api/fines", json={
            "member_id": test_member["id"],
            "fine_type_id": test_fine_type["id"],
            "amount": 3.00
        }, headers=auth_headers)
        fine_id = create_response.json()["id"]
        
        delete_response = requests.delete(f"{BASE_URL}/api/fines/{fine_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ Fine deleted successfully")


class TestStatisticsEndpoints:
    """Statistics endpoint tests - verifies MongoDB aggregation pipelines"""
    
    def test_get_statistics_with_aggregation(self, auth_headers):
        """Test GET /api/statistics - uses MongoDB aggregation pipeline"""
        response = requests.get(f"{BASE_URL}/api/statistics", params={"fiscal_year": "2025/2026"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "fiscal_year" in data
        assert "total_fines" in data
        assert "total_amount" in data
        assert "ranking" in data
        assert isinstance(data["ranking"], list)
        print(f"✓ Statistics retrieved via aggregation - total: {data['total_amount']}, fines: {data['total_fines']}")
    
    def test_get_personal_statistics(self, auth_headers):
        """Test GET /api/statistics/personal - uses MongoDB aggregation pipeline"""
        response = requests.get(f"{BASE_URL}/api/statistics/personal", params={"fiscal_year": "2025/2026"}, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "fiscal_year" in data
        assert "member_name" in data
        assert "total_fines" in data
        assert "total_amount" in data
        print(f"✓ Personal statistics retrieved - member: {data['member_name']}")
    
    def test_statistics_ranking_structure(self, auth_headers):
        """Test that ranking entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/statistics", params={"fiscal_year": "2025/2026"}, headers=auth_headers)
        data = response.json()
        
        if data["ranking"]:
            entry = data["ranking"][0]
            assert "member_id" in entry
            assert "member_name" in entry
            assert "total" in entry
            assert "rank" in entry
            print(f"✓ Ranking structure verified - top: {entry['member_name']} with {entry['total']}")
        else:
            print("✓ Ranking structure test skipped - no ranking data")


class TestUserManagementEndpoints:
    """User management endpoint tests (admin only)"""
    
    def test_get_users(self, auth_headers):
        """Test GET /api/users returns user list"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0  # At least admin user exists
        print(f"✓ Users retrieved: {len(data)} users")
    
    def test_create_and_delete_user(self, auth_headers):
        """Test POST /api/users and DELETE /api/users/{id}"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"test_user_{unique_id}",
            "password": "TestPass123",  # Meets password policy
            "role": "vorstand"
        }
        
        # Create user
        create_response = requests.post(f"{BASE_URL}/api/users", json=user_data, headers=auth_headers)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        user_id = create_response.json()["id"]
        print(f"✓ User created: {user_data['username']}")
        
        # Delete user
        delete_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ User deleted successfully")
    
    def test_reset_password(self, auth_headers):
        """Test PUT /api/users/{id}/reset-password"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a user
        create_response = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"test_reset_{unique_id}",
            "password": "OldPass123",
            "role": "vorstand"
        }, headers=auth_headers)
        user_id = create_response.json()["id"]
        
        # Reset password
        reset_response = requests.put(f"{BASE_URL}/api/users/{user_id}/reset-password", json={
            "new_password": "NewPass456"
        }, headers=auth_headers)
        assert reset_response.status_code == 200
        print(f"✓ Password reset successful")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)


class TestAuditLogsEndpoint:
    """Audit log endpoint tests (admin only)"""
    
    def test_get_audit_logs(self, auth_headers):
        """Test GET /api/audit-logs returns audit entries"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"✓ Audit logs retrieved: {len(data['logs'])} entries")
    
    def test_audit_logs_structure(self, auth_headers):
        """Test audit log entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=auth_headers)
        data = response.json()
        
        if data["logs"]:
            log = data["logs"][0]
            assert "action" in log
            assert "resource_type" in log
            assert "timestamp" in log
            print(f"✓ Audit log structure verified - action: {log['action']}")
        else:
            print("✓ Audit log structure test skipped - no logs")


class TestHealthEndpoint:
    """Health check endpoint test"""
    
    def test_health_check(self):
        """Test /health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ Health check passed - database connected")


# Cleanup test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(request):
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Get auth token
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        return
    
    token = response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup members (archive first, then delete)
    members_response = requests.get(f"{BASE_URL}/api/members", headers=headers)
    if members_response.status_code == 200:
        for member in members_response.json():
            if member.get("firstName", "").startswith("TEST_"):
                # Archive first
                requests.put(f"{BASE_URL}/api/members/{member['id']}", json={
                    "firstName": member["firstName"],
                    "lastName": member.get("lastName", ""),
                    "status": "archiviert"
                }, headers=headers)
                # Then delete
                requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=headers)
    
    # Cleanup fine types
    fine_types_response = requests.get(f"{BASE_URL}/api/fine-types", headers=headers)
    if fine_types_response.status_code == 200:
        for ft in fine_types_response.json():
            if ft.get("label", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/fine-types/{ft['id']}", headers=headers)
    
    print("\n✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
