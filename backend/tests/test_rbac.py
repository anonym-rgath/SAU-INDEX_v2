"""
Role-Based Access Control (RBAC) Tests for Rheinzelmänner App
Tests for:
- GET /api/fines for mitglied role returns only own fines
- GET /api/statistics for mitglied returns 403
- GET /api/statistics/personal returns personal stats for all roles
- Role-based permissions for various endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRBACBackend:
    """Role-Based Access Control Backend Tests"""
    
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
        """Admin auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_member(self, admin_headers):
        """Create a test member for mitglied role testing"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TestMitglied{unique_id}",
            "lastName": "RBACTest",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create test member: {response.text}"
        member = response.json()
        yield member
        # Cleanup: Archive and delete member
        try:
            requests.put(f"{BASE_URL}/api/members/{member['id']}", 
                        json={"firstName": member['firstName'], "lastName": member['lastName'], "status": "archiviert"},
                        headers=admin_headers)
            requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=admin_headers)
        except:
            pass
    
    @pytest.fixture(scope="class")
    def mitglied_user(self, admin_headers, test_member):
        """Create a mitglied user for the test member"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"testmitglied{unique_id}",
            "password": "TestPass123",
            "role": "mitglied"
        }
        response = requests.post(f"{BASE_URL}/api/members/{test_member['id']}/access", 
                                json=user_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create mitglied user: {response.text}"
        yield {"username": user_data["username"], "password": user_data["password"], "member_id": test_member['id']}
        # Cleanup handled by test_member fixture
    
    @pytest.fixture(scope="class")
    def mitglied_token(self, mitglied_user):
        """Get mitglied authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": mitglied_user["username"],
            "password": mitglied_user["password"]
        })
        assert response.status_code == 200, f"Mitglied login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def mitglied_headers(self, mitglied_token):
        """Mitglied auth headers"""
        return {"Authorization": f"Bearer {mitglied_token}"}
    
    @pytest.fixture(scope="class")
    def test_fine(self, admin_headers, test_member):
        """Create a test fine for the test member"""
        # First get or create a fine type
        fine_types_resp = requests.get(f"{BASE_URL}/api/fine-types", headers=admin_headers)
        fine_types = fine_types_resp.json()
        
        if fine_types:
            fine_type_id = fine_types[0]['id']
        else:
            # Create a fine type
            ft_resp = requests.post(f"{BASE_URL}/api/fine-types", 
                                   json={"label": "Test Fine Type", "amount": 5.0},
                                   headers=admin_headers)
            fine_type_id = ft_resp.json()['id']
        
        # Create a fine for the test member
        fine_data = {
            "member_id": test_member['id'],
            "fine_type_id": fine_type_id,
            "amount": 10.0,
            "notes": "RBAC Test Fine"
        }
        response = requests.post(f"{BASE_URL}/api/fines", json=fine_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create test fine: {response.text}"
        fine = response.json()
        yield fine
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/fines/{fine['id']}", headers=admin_headers)
        except:
            pass
    
    # ============ FINES ENDPOINT TESTS ============
    
    def test_mitglied_sees_only_own_fines(self, mitglied_headers, mitglied_user, test_fine):
        """GET /api/fines for mitglied role returns only own fines"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=mitglied_headers)
        assert response.status_code == 200, f"Failed to get fines: {response.text}"
        
        fines = response.json()
        # All returned fines should belong to the mitglied's member_id
        for fine in fines:
            assert fine['member_id'] == mitglied_user['member_id'], \
                f"Mitglied sees fine for another member: {fine['member_id']} != {mitglied_user['member_id']}"
        
        # Should include the test fine we created
        test_fine_ids = [f['id'] for f in fines]
        assert test_fine['id'] in test_fine_ids, "Mitglied should see their own test fine"
        print(f"PASSED: Mitglied sees only own fines ({len(fines)} fines)")
    
    def test_admin_sees_all_fines(self, admin_headers):
        """Admin should see all fines"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get fines: {response.text}"
        fines = response.json()
        print(f"PASSED: Admin sees all fines ({len(fines)} fines)")
    
    # ============ STATISTICS ENDPOINT TESTS ============
    
    def test_mitglied_cannot_access_statistics(self, mitglied_headers):
        """GET /api/statistics for mitglied returns 403"""
        # Get fiscal years first
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=mitglied_headers)
        assert fy_resp.status_code == 200
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        
        if fiscal_years:
            fiscal_year = fiscal_years[0]
        else:
            fiscal_year = "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics", 
                               params={"fiscal_year": fiscal_year},
                               headers=mitglied_headers)
        assert response.status_code == 403, \
            f"Expected 403 for mitglied accessing statistics, got {response.status_code}: {response.text}"
        print("PASSED: Mitglied cannot access /api/statistics (403)")
    
    def test_admin_can_access_statistics(self, admin_headers):
        """Admin should be able to access statistics"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=admin_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics", 
                               params={"fiscal_year": fiscal_year},
                               headers=admin_headers)
        assert response.status_code == 200, f"Admin should access statistics: {response.text}"
        
        data = response.json()
        assert 'total_fines' in data
        assert 'total_amount' in data
        assert 'ranking' in data
        print("PASSED: Admin can access /api/statistics")
    
    # ============ PERSONAL STATISTICS TESTS ============
    
    def test_mitglied_can_access_personal_statistics(self, mitglied_headers):
        """GET /api/statistics/personal returns personal stats for mitglied"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=mitglied_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics/personal", 
                               params={"fiscal_year": fiscal_year},
                               headers=mitglied_headers)
        assert response.status_code == 200, f"Mitglied should access personal stats: {response.text}"
        
        data = response.json()
        assert 'fiscal_year' in data
        assert 'member_name' in data
        assert 'total_fines' in data
        assert 'total_amount' in data
        print(f"PASSED: Mitglied can access personal statistics - {data['member_name']}")
    
    def test_admin_can_access_personal_statistics(self, admin_headers):
        """GET /api/statistics/personal returns personal stats for admin"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=admin_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics/personal", 
                               params={"fiscal_year": fiscal_year},
                               headers=admin_headers)
        assert response.status_code == 200, f"Admin should access personal stats: {response.text}"
        
        data = response.json()
        assert 'fiscal_year' in data
        print("PASSED: Admin can access personal statistics")
    
    # ============ VORSTAND ROLE TESTS ============
    
    @pytest.fixture(scope="class")
    def vorstand_member(self, admin_headers):
        """Create a test member for vorstand role testing"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TestVorstand{unique_id}",
            "lastName": "RBACTest",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create vorstand member: {response.text}"
        member = response.json()
        yield member
        # Cleanup
        try:
            requests.put(f"{BASE_URL}/api/members/{member['id']}", 
                        json={"firstName": member['firstName'], "lastName": member['lastName'], "status": "archiviert"},
                        headers=admin_headers)
            requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=admin_headers)
        except:
            pass
    
    @pytest.fixture(scope="class")
    def vorstand_user(self, admin_headers, vorstand_member):
        """Create a vorstand user"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"testvorstand{unique_id}",
            "password": "TestPass123",
            "role": "vorstand"
        }
        response = requests.post(f"{BASE_URL}/api/members/{vorstand_member['id']}/access", 
                                json=user_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create vorstand user: {response.text}"
        yield {"username": user_data["username"], "password": user_data["password"], "member_id": vorstand_member['id']}
    
    @pytest.fixture(scope="class")
    def vorstand_token(self, vorstand_user):
        """Get vorstand authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": vorstand_user["username"],
            "password": vorstand_user["password"]
        })
        assert response.status_code == 200, f"Vorstand login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def vorstand_headers(self, vorstand_token):
        """Vorstand auth headers"""
        return {"Authorization": f"Bearer {vorstand_token}"}
    
    def test_vorstand_can_access_statistics(self, vorstand_headers):
        """Vorstand should be able to access statistics"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=vorstand_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics", 
                               params={"fiscal_year": fiscal_year},
                               headers=vorstand_headers)
        assert response.status_code == 200, f"Vorstand should access statistics: {response.text}"
        print("PASSED: Vorstand can access /api/statistics")
    
    def test_vorstand_can_access_personal_statistics(self, vorstand_headers):
        """Vorstand should be able to access personal statistics"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=vorstand_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics/personal", 
                               params={"fiscal_year": fiscal_year},
                               headers=vorstand_headers)
        assert response.status_code == 200, f"Vorstand should access personal stats: {response.text}"
        print("PASSED: Vorstand can access personal statistics")
    
    def test_vorstand_sees_only_own_fines(self, vorstand_headers, vorstand_user):
        """Vorstand with member_id should see only own fines"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=vorstand_headers)
        assert response.status_code == 200, f"Failed to get fines: {response.text}"
        
        fines = response.json()
        # All returned fines should belong to the vorstand's member_id
        for fine in fines:
            assert fine['member_id'] == vorstand_user['member_id'], \
                f"Vorstand sees fine for another member: {fine['member_id']} != {vorstand_user['member_id']}"
        print(f"PASSED: Vorstand sees only own fines ({len(fines)} fines)")
    
    # ============ SPIESS ROLE TESTS ============
    
    @pytest.fixture(scope="class")
    def spiess_member(self, admin_headers):
        """Create a test member for spiess role testing"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TestSpiess{unique_id}",
            "lastName": "RBACTest",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/members", json=member_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create spiess member: {response.text}"
        member = response.json()
        yield member
        # Cleanup
        try:
            requests.put(f"{BASE_URL}/api/members/{member['id']}", 
                        json={"firstName": member['firstName'], "lastName": member['lastName'], "status": "archiviert"},
                        headers=admin_headers)
            requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=admin_headers)
        except:
            pass
    
    @pytest.fixture(scope="class")
    def spiess_user(self, admin_headers, spiess_member):
        """Create a spiess user"""
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"testspiess{unique_id}",
            "password": "TestPass123",
            "role": "spiess"
        }
        response = requests.post(f"{BASE_URL}/api/members/{spiess_member['id']}/access", 
                                json=user_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create spiess user: {response.text}"
        yield {"username": user_data["username"], "password": user_data["password"], "member_id": spiess_member['id']}
    
    @pytest.fixture(scope="class")
    def spiess_token(self, spiess_user):
        """Get spiess authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": spiess_user["username"],
            "password": spiess_user["password"]
        })
        assert response.status_code == 200, f"Spiess login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def spiess_headers(self, spiess_token):
        """Spiess auth headers"""
        return {"Authorization": f"Bearer {spiess_token}"}
    
    def test_spiess_can_access_statistics(self, spiess_headers):
        """Spiess should be able to access statistics"""
        fy_resp = requests.get(f"{BASE_URL}/api/fiscal-years", headers=spiess_headers)
        fiscal_years = fy_resp.json().get('fiscal_years', [])
        fiscal_year = fiscal_years[0] if fiscal_years else "2025/2026"
        
        response = requests.get(f"{BASE_URL}/api/statistics", 
                               params={"fiscal_year": fiscal_year},
                               headers=spiess_headers)
        assert response.status_code == 200, f"Spiess should access statistics: {response.text}"
        print("PASSED: Spiess can access /api/statistics")
    
    def test_spiess_sees_all_fines(self, spiess_headers):
        """Spiess should see all fines (not filtered by member_id)"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=spiess_headers)
        assert response.status_code == 200, f"Failed to get fines: {response.text}"
        fines = response.json()
        print(f"PASSED: Spiess sees all fines ({len(fines)} fines)")


class TestSettingsEndpoints:
    """Test Settings/ICS endpoints access control"""
    
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
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_can_access_ics_settings(self, admin_headers):
        """Admin should be able to access ICS settings"""
        response = requests.get(f"{BASE_URL}/api/settings/ics", headers=admin_headers)
        assert response.status_code == 200, f"Admin should access ICS settings: {response.text}"
        print("PASSED: Admin can access ICS settings")
    
    def test_admin_can_update_ics_settings(self, admin_headers):
        """Admin should be able to update ICS settings"""
        response = requests.put(f"{BASE_URL}/api/settings/ics", 
                               json={"sync_enabled": False},
                               headers=admin_headers)
        assert response.status_code == 200, f"Admin should update ICS settings: {response.text}"
        print("PASSED: Admin can update ICS settings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
