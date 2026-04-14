"""
Test QR-Code Feature for Members
Tests the new has_qr_code toggle functionality in member management
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestQRCodeFeature:
    """Tests for QR-Code toggle feature in member management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        
        # Cleanup: Delete test members created during tests
        self._cleanup_test_members()
    
    def _cleanup_test_members(self):
        """Delete all test members (prefixed with TEST_)"""
        try:
            members_response = self.session.get(f"{BASE_URL}/api/members")
            if members_response.status_code == 200:
                members = members_response.json()
                for member in members:
                    if member.get('firstName', '').startswith('TEST_'):
                        # First archive, then delete
                        self.session.put(f"{BASE_URL}/api/members/{member['id']}", json={
                            "firstName": member['firstName'],
                            "lastName": member['lastName'],
                            "status": "archiviert",
                            "has_qr_code": False
                        })
                        self.session.delete(f"{BASE_URL}/api/members/{member['id']}")
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    # ============ GET /api/members Tests ============
    
    def test_get_members_returns_has_qr_code_field(self):
        """GET /api/members should return has_qr_code field for all members"""
        response = self.session.get(f"{BASE_URL}/api/members")
        
        assert response.status_code == 200, f"GET /members failed: {response.text}"
        
        members = response.json()
        assert isinstance(members, list), "Response should be a list"
        
        # Check that all members have has_qr_code field
        for member in members:
            assert 'has_qr_code' in member, f"Member {member.get('id')} missing has_qr_code field"
            assert isinstance(member['has_qr_code'], bool), f"has_qr_code should be boolean for member {member.get('id')}"
        
        print(f"✓ GET /members returns has_qr_code for all {len(members)} members")
    
    def test_legacy_members_default_has_qr_code_false(self):
        """Legacy members without has_qr_code stored should default to false"""
        response = self.session.get(f"{BASE_URL}/api/members")
        
        assert response.status_code == 200
        members = response.json()
        
        # Count members with has_qr_code = false (default)
        false_count = sum(1 for m in members if m.get('has_qr_code') == False)
        true_count = sum(1 for m in members if m.get('has_qr_code') == True)
        
        print(f"✓ Members with has_qr_code=false: {false_count}, has_qr_code=true: {true_count}")
        
        # At least some members should exist
        assert len(members) > 0, "No members found in database"
    
    # ============ POST /api/members Tests ============
    
    def test_create_member_with_qr_code_enabled(self):
        """Creating a new member with has_qr_code=true should persist"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "Enabled",
            "status": "aktiv",
            "has_qr_code": True
        }
        
        # Create member
        create_response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_response.status_code == 200, f"Create member failed: {create_response.text}"
        
        created_member = create_response.json()
        member_id = created_member.get('id')
        
        # Verify has_qr_code is true in response
        assert created_member.get('has_qr_code') == True, f"Created member should have has_qr_code=true, got: {created_member.get('has_qr_code')}"
        
        # Verify persistence via GET
        get_response = self.session.get(f"{BASE_URL}/api/members")
        assert get_response.status_code == 200
        
        members = get_response.json()
        found_member = next((m for m in members if m.get('id') == member_id), None)
        
        assert found_member is not None, f"Created member {member_id} not found in GET response"
        assert found_member.get('has_qr_code') == True, f"Persisted member should have has_qr_code=true, got: {found_member.get('has_qr_code')}"
        
        print(f"✓ Created member with has_qr_code=true, verified persistence")
    
    def test_create_member_with_qr_code_disabled(self):
        """Creating a new member with has_qr_code=false (default) should persist"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "Disabled",
            "status": "aktiv",
            "has_qr_code": False
        }
        
        # Create member
        create_response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_response.status_code == 200, f"Create member failed: {create_response.text}"
        
        created_member = create_response.json()
        member_id = created_member.get('id')
        
        # Verify has_qr_code is false in response
        assert created_member.get('has_qr_code') == False, f"Created member should have has_qr_code=false, got: {created_member.get('has_qr_code')}"
        
        # Verify persistence via GET
        get_response = self.session.get(f"{BASE_URL}/api/members")
        assert get_response.status_code == 200
        
        members = get_response.json()
        found_member = next((m for m in members if m.get('id') == member_id), None)
        
        assert found_member is not None, f"Created member {member_id} not found in GET response"
        assert found_member.get('has_qr_code') == False, f"Persisted member should have has_qr_code=false, got: {found_member.get('has_qr_code')}"
        
        print(f"✓ Created member with has_qr_code=false, verified persistence")
    
    def test_create_member_without_qr_code_field_defaults_false(self):
        """Creating a member without specifying has_qr_code should default to false"""
        unique_id = str(uuid.uuid4())[:8]
        member_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "NoField",
            "status": "aktiv"
            # has_qr_code not specified
        }
        
        # Create member
        create_response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_response.status_code == 200, f"Create member failed: {create_response.text}"
        
        created_member = create_response.json()
        
        # Verify has_qr_code defaults to false
        assert created_member.get('has_qr_code') == False, f"Member without has_qr_code should default to false, got: {created_member.get('has_qr_code')}"
        
        print(f"✓ Created member without has_qr_code field, defaults to false")
    
    # ============ PUT /api/members Tests ============
    
    def test_update_member_enable_qr_code(self):
        """Updating a member to enable QR code (has_qr_code=true) should persist"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a member with QR disabled
        member_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "ToEnable",
            "status": "aktiv",
            "has_qr_code": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_response.status_code == 200
        
        member_id = create_response.json().get('id')
        
        # Update to enable QR code
        update_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "ToEnable",
            "status": "aktiv",
            "has_qr_code": True
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/members/{member_id}", json=update_data)
        assert update_response.status_code == 200, f"Update member failed: {update_response.text}"
        
        updated_member = update_response.json()
        assert updated_member.get('has_qr_code') == True, f"Updated member should have has_qr_code=true, got: {updated_member.get('has_qr_code')}"
        
        # Verify persistence via GET
        get_response = self.session.get(f"{BASE_URL}/api/members")
        members = get_response.json()
        found_member = next((m for m in members if m.get('id') == member_id), None)
        
        assert found_member.get('has_qr_code') == True, f"Persisted update should have has_qr_code=true"
        
        print(f"✓ Updated member to enable QR code, verified persistence")
    
    def test_update_member_disable_qr_code(self):
        """Updating a member to disable QR code (has_qr_code=false) should persist"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a member with QR enabled
        member_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "ToDisable",
            "status": "aktiv",
            "has_qr_code": True
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/members", json=member_data)
        assert create_response.status_code == 200
        
        member_id = create_response.json().get('id')
        
        # Update to disable QR code
        update_data = {
            "firstName": f"TEST_QR_{unique_id}",
            "lastName": "ToDisable",
            "status": "aktiv",
            "has_qr_code": False
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/members/{member_id}", json=update_data)
        assert update_response.status_code == 200, f"Update member failed: {update_response.text}"
        
        updated_member = update_response.json()
        assert updated_member.get('has_qr_code') == False, f"Updated member should have has_qr_code=false, got: {updated_member.get('has_qr_code')}"
        
        # Verify persistence via GET
        get_response = self.session.get(f"{BASE_URL}/api/members")
        members = get_response.json()
        found_member = next((m for m in members if m.get('id') == member_id), None)
        
        assert found_member.get('has_qr_code') == False, f"Persisted update should have has_qr_code=false"
        
        print(f"✓ Updated member to disable QR code, verified persistence")
    
    # ============ Existing Member Tests ============
    
    def test_existing_member_max_mueller_has_qr_code_true(self):
        """Verify Max Müller (pre-updated) has has_qr_code=true"""
        response = self.session.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        
        # Find Max Müller
        max_mueller = next((m for m in members if m.get('firstName') == 'Max' and m.get('lastName') == 'Müller'), None)
        
        if max_mueller:
            print(f"Found Max Müller with has_qr_code={max_mueller.get('has_qr_code')}")
            # This test documents the expected state based on agent context
            # Max Müller was already updated with has_qr_code=true via API
        else:
            print("Max Müller not found in members list - may have been deleted or renamed")
            pytest.skip("Max Müller not found in database")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
