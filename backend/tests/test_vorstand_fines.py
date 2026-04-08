"""
Test suite for Vorstand fine creation feature.
Tests the new functionality where Vorstand can create fines ONLY for members 
linked to spiess/vorstand users.

Test Coverage:
- GET /api/fines/eligible-members - returns correct members based on role
- POST /api/fines - vorstand can create fines only for eligible members
- GET /api/fines - vorstand sees fines of spiess/vorstand-linked members
- PUT/DELETE /api/fines - vorstand cannot edit/delete (admin/spiess only)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
VORSTAND_CREDS = {"username": "Henrik", "password": "Vorstand1!"}
SPIESS_CREDS = {"username": "Robin12", "password": "Spiess123!"}


class TestAuth:
    """Authentication tests to ensure test setup is correct"""
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["role"] == "admin"
        assert "token" in data
        print(f"✓ Admin login successful")
    
    def test_vorstand_login(self):
        """Vorstand can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        assert response.status_code == 200, f"Vorstand login failed: {response.text}"
        data = response.json()
        assert data["role"] == "vorstand"
        assert data.get("member_id") is not None, "Vorstand should have member_id"
        print(f"✓ Vorstand login successful, member_id: {data['member_id']}")
    
    def test_spiess_login(self):
        """Spiess can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SPIESS_CREDS)
        assert response.status_code == 200, f"Spiess login failed: {response.text}"
        data = response.json()
        assert data["role"] == "spiess"
        assert data.get("member_id") is not None, "Spiess should have member_id"
        print(f"✓ Spiess login successful, member_id: {data['member_id']}")


class TestEligibleMembers:
    """Tests for GET /api/fines/eligible-members endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vorstand_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def spiess_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SPIESS_CREDS)
        return response.json()["token"]
    
    def test_admin_gets_all_active_members(self, admin_token):
        """Admin should get all active (non-archived) members"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get eligible members
        response = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        eligible = response.json()
        
        # Get all members for comparison
        all_members_resp = requests.get(f"{BASE_URL}/api/members", headers=headers)
        all_members = all_members_resp.json()
        active_members = [m for m in all_members if m.get("status") != "archiviert"]
        
        assert len(eligible) == len(active_members), \
            f"Admin should see all {len(active_members)} active members, got {len(eligible)}"
        print(f"✓ Admin sees all {len(eligible)} active members as eligible")
    
    def test_spiess_gets_all_active_members(self, spiess_token):
        """Spiess should get all active (non-archived) members"""
        headers = {"Authorization": f"Bearer {spiess_token}"}
        
        response = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        eligible = response.json()
        
        # Spiess should see all active members
        all_members_resp = requests.get(f"{BASE_URL}/api/members", headers=headers)
        all_members = all_members_resp.json()
        active_members = [m for m in all_members if m.get("status") != "archiviert"]
        
        assert len(eligible) == len(active_members), \
            f"Spiess should see all {len(active_members)} active members, got {len(eligible)}"
        print(f"✓ Spiess sees all {len(eligible)} active members as eligible")
    
    def test_vorstand_gets_only_spiess_vorstand_members(self, vorstand_token, admin_token):
        """Vorstand should only get members linked to spiess/vorstand users"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        
        response = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        eligible = response.json()
        
        # Get all users to find spiess/vorstand member_ids
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_resp.json()
        
        spiess_vorstand_member_ids = set()
        for user in users:
            if user.get("role") in ["spiess", "vorstand"] and user.get("member_id"):
                spiess_vorstand_member_ids.add(user["member_id"])
        
        eligible_ids = {m["id"] for m in eligible}
        
        # All eligible members should be in spiess/vorstand set
        assert eligible_ids.issubset(spiess_vorstand_member_ids), \
            f"Vorstand should only see spiess/vorstand members. Got extra: {eligible_ids - spiess_vorstand_member_ids}"
        
        print(f"✓ Vorstand sees {len(eligible)} eligible members (spiess/vorstand only)")
        print(f"  Expected member_ids: {spiess_vorstand_member_ids}")
        print(f"  Got member_ids: {eligible_ids}")


class TestVorstandFineCreation:
    """Tests for POST /api/fines with vorstand role"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vorstand_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vorstand_member_id(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        return response.json()["member_id"]
    
    @pytest.fixture
    def fine_type_id(self, admin_token):
        """Get or create a fine type for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/fine-types", headers=headers)
        fine_types = response.json()
        if fine_types:
            return fine_types[0]["id"]
        # Create one if none exists
        create_resp = requests.post(
            f"{BASE_URL}/api/fine-types",
            headers=headers,
            json={"label": "TEST_Teststrafe", "amount": 5.0}
        )
        return create_resp.json()["id"]
    
    def test_vorstand_can_create_fine_for_eligible_member(self, vorstand_token, vorstand_member_id, fine_type_id):
        """Vorstand can create fine for spiess/vorstand-linked member"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        
        # Get eligible members
        eligible_resp = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        eligible = eligible_resp.json()
        assert len(eligible) > 0, "No eligible members found for vorstand"
        
        target_member_id = eligible[0]["id"]
        
        # Create fine
        fine_data = {
            "member_id": target_member_id,
            "fine_type_id": fine_type_id,
            "amount": 5.0,
            "notes": "TEST_Vorstand created fine"
        }
        
        response = requests.post(f"{BASE_URL}/api/fines", headers=headers, json=fine_data)
        assert response.status_code == 200, f"Failed to create fine: {response.text}"
        
        created_fine = response.json()
        assert created_fine["member_id"] == target_member_id
        assert created_fine["amount"] == 5.0
        print(f"✓ Vorstand successfully created fine for eligible member {target_member_id}")
        
        # Cleanup - delete the fine (need admin/spiess)
        return created_fine["id"]
    
    def test_vorstand_cannot_create_fine_for_mitglied(self, vorstand_token, admin_token, fine_type_id):
        """Vorstand cannot create fine for regular mitglied (not spiess/vorstand)"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all members
        members_resp = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        all_members = members_resp.json()
        
        # Get users to find mitglied-only members
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_resp.json()
        
        spiess_vorstand_member_ids = set()
        for user in users:
            if user.get("role") in ["spiess", "vorstand"] and user.get("member_id"):
                spiess_vorstand_member_ids.add(user["member_id"])
        
        # Find a member NOT linked to spiess/vorstand
        mitglied_only = None
        for member in all_members:
            if member.get("status") != "archiviert" and member["id"] not in spiess_vorstand_member_ids:
                mitglied_only = member
                break
        
        if not mitglied_only:
            pytest.skip("No mitglied-only member found for testing")
        
        # Try to create fine for mitglied
        fine_data = {
            "member_id": mitglied_only["id"],
            "fine_type_id": fine_type_id,
            "amount": 5.0,
            "notes": "TEST_Should fail"
        }
        
        response = requests.post(f"{BASE_URL}/api/fines", headers=headers, json=fine_data)
        assert response.status_code == 403, \
            f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
        
        error_detail = response.json().get("detail", "")
        assert "Vorstand" in error_detail or "Spieß" in error_detail, \
            f"Error message should mention Vorstand/Spieß restriction: {error_detail}"
        
        print(f"✓ Vorstand correctly blocked from creating fine for mitglied {mitglied_only['id']}")


class TestVorstandFineVisibility:
    """Tests for GET /api/fines with vorstand role"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vorstand_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        return response.json()["token"]
    
    def test_vorstand_sees_spiess_vorstand_fines(self, vorstand_token, admin_token):
        """Vorstand should see fines of all spiess/vorstand-linked members"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get fines as vorstand
        response = requests.get(f"{BASE_URL}/api/fines", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        vorstand_fines = response.json()
        
        # Get users to find spiess/vorstand member_ids
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        users = users_resp.json()
        
        spiess_vorstand_member_ids = set()
        for user in users:
            if user.get("role") in ["spiess", "vorstand"] and user.get("member_id"):
                spiess_vorstand_member_ids.add(user["member_id"])
        
        # All fines should be for spiess/vorstand members
        for fine in vorstand_fines:
            assert fine["member_id"] in spiess_vorstand_member_ids, \
                f"Vorstand should not see fine for member {fine['member_id']}"
        
        print(f"✓ Vorstand sees {len(vorstand_fines)} fines (all for spiess/vorstand members)")


class TestVorstandCannotEditDelete:
    """Tests that vorstand cannot edit or delete fines"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def vorstand_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=VORSTAND_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def spiess_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SPIESS_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def test_fine_id(self, admin_token):
        """Create a test fine and return its ID"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get a fine type
        ft_resp = requests.get(f"{BASE_URL}/api/fine-types", headers=headers)
        fine_types = ft_resp.json()
        if not fine_types:
            pytest.skip("No fine types available")
        
        # Get eligible members
        members_resp = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        members = members_resp.json()
        if not members:
            pytest.skip("No members available")
        
        # Create test fine
        fine_data = {
            "member_id": members[0]["id"],
            "fine_type_id": fine_types[0]["id"],
            "amount": 1.0,
            "notes": "TEST_Fine for edit/delete test"
        }
        
        response = requests.post(f"{BASE_URL}/api/fines", headers=headers, json=fine_data)
        if response.status_code != 200:
            pytest.skip(f"Could not create test fine: {response.text}")
        
        fine_id = response.json()["id"]
        yield fine_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/fines/{fine_id}", headers=headers)
    
    def test_vorstand_cannot_edit_fine(self, vorstand_token, test_fine_id):
        """Vorstand should get 403 when trying to edit a fine"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        
        update_data = {"amount": 10.0, "notes": "TEST_Updated by vorstand"}
        response = requests.put(
            f"{BASE_URL}/api/fines/{test_fine_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for vorstand edit, got {response.status_code}: {response.text}"
        print(f"✓ Vorstand correctly blocked from editing fine")
    
    def test_vorstand_cannot_delete_fine(self, vorstand_token, test_fine_id):
        """Vorstand should get 403 when trying to delete a fine"""
        headers = {"Authorization": f"Bearer {vorstand_token}"}
        
        response = requests.delete(f"{BASE_URL}/api/fines/{test_fine_id}", headers=headers)
        
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for vorstand delete, got {response.status_code}: {response.text}"
        print(f"✓ Vorstand correctly blocked from deleting fine")
    
    def test_spiess_can_edit_fine(self, spiess_token, test_fine_id):
        """Spiess should be able to edit fines"""
        headers = {"Authorization": f"Bearer {spiess_token}"}
        
        update_data = {"amount": 7.5, "notes": "TEST_Updated by spiess"}
        response = requests.put(
            f"{BASE_URL}/api/fines/{test_fine_id}",
            headers=headers,
            json=update_data
        )
        
        assert response.status_code == 200, \
            f"Spiess should be able to edit fine, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated["amount"] == 7.5
        print(f"✓ Spiess can edit fines")
    
    def test_admin_can_delete_fine(self, admin_token):
        """Admin should be able to delete fines"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a fine to delete
        ft_resp = requests.get(f"{BASE_URL}/api/fine-types", headers=headers)
        fine_types = ft_resp.json()
        members_resp = requests.get(f"{BASE_URL}/api/fines/eligible-members", headers=headers)
        members = members_resp.json()
        
        if not fine_types or not members:
            pytest.skip("No fine types or members available")
        
        fine_data = {
            "member_id": members[0]["id"],
            "fine_type_id": fine_types[0]["id"],
            "amount": 1.0,
            "notes": "TEST_Fine to delete"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/fines", headers=headers, json=fine_data)
        fine_id = create_resp.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/fines/{fine_id}", headers=headers)
        assert response.status_code == 200, \
            f"Admin should be able to delete fine, got {response.status_code}: {response.text}"
        print(f"✓ Admin can delete fines")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
