"""
Test suite for Event Fine Type feature
Tests the new fine_type_id based event creation/update instead of manual fine_amount
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestEventCreateWithFineType:
    """Tests for POST /api/events with fine_type_id"""
    
    def test_create_event_with_fine_type_id(self, auth_headers):
        """POST /api/events with fine_type_id creates event with correct fine_amount and fine_enabled=True"""
        # Create fine type for this test
        fine_type_data = {
            "label": f"TEST_EventFineType_{uuid.uuid4().hex[:8]}",
            "amount": 15.0
        }
        ft_response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data, headers=auth_headers)
        assert ft_response.status_code == 200, f"Failed to create fine type: {ft_response.text}"
        test_fine_type = ft_response.json()
        
        try:
            event_data = {
                "title": f"TEST_Event_WithFineType_{uuid.uuid4().hex[:8]}",
                "date": "2026-06-15T18:00:00",
                "location": "Test Location",
                "fine_type_id": test_fine_type["id"]
            }
            response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
            assert response.status_code == 200, f"Failed to create event: {response.text}"
            
            result = response.json()
            assert "id" in result, "Response should contain event id"
            event_id = result["id"]
            
            # Verify event was created with correct fine settings
            get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
            assert get_response.status_code == 200
            event = get_response.json()
            
            assert event["fine_type_id"] == test_fine_type["id"], "fine_type_id should match"
            assert event["fine_amount"] == test_fine_type["amount"], f"fine_amount should be {test_fine_type['amount']}"
            assert event["fine_enabled"] == True, "fine_enabled should be True"
            
            # Cleanup event
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
            print(f"✓ Event created with fine_type_id has correct fine_amount={event['fine_amount']} and fine_enabled=True")
        finally:
            # Cleanup fine type
            requests.delete(f"{BASE_URL}/api/fine-types/{test_fine_type['id']}", headers=auth_headers)
    
    def test_create_event_without_fine_type_id(self, auth_headers):
        """POST /api/events without fine_type_id creates event with fine_amount=0 and fine_enabled=False"""
        event_data = {
            "title": f"TEST_Event_NoFineType_{uuid.uuid4().hex[:8]}",
            "date": "2026-06-16T18:00:00",
            "location": "Test Location"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        
        result = response.json()
        event_id = result["id"]
        
        try:
            # Verify event was created without fine
            get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
            assert get_response.status_code == 200
            event = get_response.json()
            
            assert event.get("fine_type_id") is None, "fine_type_id should be None"
            assert event["fine_amount"] == 0, "fine_amount should be 0"
            assert event["fine_enabled"] == False, "fine_enabled should be False"
            print("✓ Event created without fine_type_id has fine_amount=0 and fine_enabled=False")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
    
    def test_create_event_with_invalid_fine_type_id(self, auth_headers):
        """POST /api/events with invalid fine_type_id returns 404"""
        event_data = {
            "title": f"TEST_Event_InvalidFineType_{uuid.uuid4().hex[:8]}",
            "date": "2026-06-17T18:00:00",
            "fine_type_id": "invalid-uuid-that-does-not-exist"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        assert "Strafenart nicht gefunden" in response.json().get("detail", "")
        print("✓ Event creation with invalid fine_type_id returns 404")


class TestEventUpdateWithFineType:
    """Tests for PUT /api/events/{id} with fine_type_id"""
    
    def test_update_event_with_fine_type_id(self, auth_headers):
        """PUT /api/events/{id} with fine_type_id updates fine_amount from fine type"""
        # Create fine types for this test
        fine_type_data1 = {"label": f"TEST_FineType1_{uuid.uuid4().hex[:8]}", "amount": 15.0}
        fine_type_data2 = {"label": f"TEST_FineType2_{uuid.uuid4().hex[:8]}", "amount": 25.0}
        
        ft1_response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data1, headers=auth_headers)
        ft2_response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data2, headers=auth_headers)
        assert ft1_response.status_code == 200
        assert ft2_response.status_code == 200
        
        test_fine_type = ft1_response.json()
        second_fine_type = ft2_response.json()
        
        try:
            # Create event without fine first
            event_data = {
                "title": f"TEST_Event_UpdateFine_{uuid.uuid4().hex[:8]}",
                "date": "2026-06-18T18:00:00"
            }
            create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
            assert create_response.status_code == 200
            event_id = create_response.json()["id"]
            
            try:
                # Update with fine_type_id
                update_data = {"fine_type_id": test_fine_type["id"]}
                update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data, headers=auth_headers)
                assert update_response.status_code == 200, f"Failed to update event: {update_response.text}"
                
                # Verify update
                get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event = get_response.json()
                
                assert event["fine_type_id"] == test_fine_type["id"], "fine_type_id should be updated"
                assert event["fine_amount"] == test_fine_type["amount"], f"fine_amount should be {test_fine_type['amount']}"
                assert event["fine_enabled"] == True, "fine_enabled should be True after update"
                
                # Update to different fine type
                update_data2 = {"fine_type_id": second_fine_type["id"]}
                update_response2 = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data2, headers=auth_headers)
                assert update_response2.status_code == 200
                
                get_response2 = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event2 = get_response2.json()
                
                assert event2["fine_type_id"] == second_fine_type["id"], "fine_type_id should be updated to second"
                assert event2["fine_amount"] == second_fine_type["amount"], f"fine_amount should be {second_fine_type['amount']}"
                print("✓ Event update with fine_type_id correctly updates fine_amount from fine type")
            finally:
                # Cleanup event
                requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        finally:
            # Cleanup fine types
            requests.delete(f"{BASE_URL}/api/fine-types/{test_fine_type['id']}", headers=auth_headers)
            requests.delete(f"{BASE_URL}/api/fine-types/{second_fine_type['id']}", headers=auth_headers)
    
    def test_update_event_with_invalid_fine_type_id(self, auth_headers):
        """PUT /api/events/{id} with invalid fine_type_id returns 404"""
        # Create event first
        event_data = {
            "title": f"TEST_Event_UpdateInvalid_{uuid.uuid4().hex[:8]}",
            "date": "2026-06-19T18:00:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        try:
            # Try to update with invalid fine_type_id
            update_data = {"fine_type_id": "invalid-uuid-that-does-not-exist"}
            update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data, headers=auth_headers)
            assert update_response.status_code == 404, f"Expected 404, got {update_response.status_code}"
            print("✓ Event update with invalid fine_type_id returns 404")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)


class TestEventFineToggle:
    """Tests for PUT /api/events/{id}/fine-toggle"""
    
    def test_toggle_fine_activate_with_fine_type_id(self, auth_headers):
        """PUT /api/events/{id}/fine-toggle with fine_type_id activates fine"""
        # Create fine type for this test
        fine_type_data = {"label": f"TEST_ToggleFineType_{uuid.uuid4().hex[:8]}", "amount": 18.0}
        ft_response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data, headers=auth_headers)
        assert ft_response.status_code == 200
        test_fine_type = ft_response.json()
        
        try:
            # Create event without fine
            event_data = {
                "title": f"TEST_Event_ToggleActivate_{uuid.uuid4().hex[:8]}",
                "date": "2026-06-20T18:00:00"
            }
            create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
            assert create_response.status_code == 200
            event_id = create_response.json()["id"]
            
            try:
                # Verify fine is disabled
                get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event = get_response.json()
                assert event["fine_enabled"] == False, "fine_enabled should be False initially"
                
                # Toggle fine ON with fine_type_id
                toggle_data = {"fine_type_id": test_fine_type["id"]}
                toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", json=toggle_data, headers=auth_headers)
                assert toggle_response.status_code == 200, f"Failed to toggle fine: {toggle_response.text}"
                
                result = toggle_response.json()
                assert result["fine_enabled"] == True, "fine_enabled should be True after toggle"
                
                # Verify event was updated
                get_response2 = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event2 = get_response2.json()
                
                assert event2["fine_enabled"] == True, "fine_enabled should be True"
                assert event2["fine_type_id"] == test_fine_type["id"], "fine_type_id should be set"
                assert event2["fine_amount"] == test_fine_type["amount"], f"fine_amount should be {test_fine_type['amount']}"
                print("✓ Fine toggle with fine_type_id activates fine correctly")
            finally:
                # Cleanup event
                requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        finally:
            # Cleanup fine type
            requests.delete(f"{BASE_URL}/api/fine-types/{test_fine_type['id']}", headers=auth_headers)
    
    def test_toggle_fine_deactivate_without_body(self, auth_headers):
        """PUT /api/events/{id}/fine-toggle without body deactivates fine"""
        # Create fine type for this test
        fine_type_data = {"label": f"TEST_DeactivateFineType_{uuid.uuid4().hex[:8]}", "amount": 22.0}
        ft_response = requests.post(f"{BASE_URL}/api/fine-types", json=fine_type_data, headers=auth_headers)
        assert ft_response.status_code == 200
        test_fine_type = ft_response.json()
        
        try:
            # Create event WITH fine
            event_data = {
                "title": f"TEST_Event_ToggleDeactivate_{uuid.uuid4().hex[:8]}",
                "date": "2026-06-21T18:00:00",
                "fine_type_id": test_fine_type["id"]
            }
            create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
            assert create_response.status_code == 200, f"Failed to create event: {create_response.text}"
            event_id = create_response.json()["id"]
            
            try:
                # Verify fine is enabled
                get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event = get_response.json()
                assert event["fine_enabled"] == True, "fine_enabled should be True initially"
                
                # Toggle fine OFF (no body or empty body)
                toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", json={}, headers=auth_headers)
                assert toggle_response.status_code == 200, f"Failed to toggle fine off: {toggle_response.text}"
                
                result = toggle_response.json()
                assert result["fine_enabled"] == False, "fine_enabled should be False after toggle"
                
                # Verify event was updated
                get_response2 = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
                event2 = get_response2.json()
                
                assert event2["fine_enabled"] == False, "fine_enabled should be False"
                assert event2.get("fine_type_id") is None, "fine_type_id should be None"
                assert event2["fine_amount"] == 0, "fine_amount should be 0"
                print("✓ Fine toggle without body deactivates fine correctly")
            finally:
                # Cleanup event
                requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        finally:
            # Cleanup fine type
            requests.delete(f"{BASE_URL}/api/fine-types/{test_fine_type['id']}", headers=auth_headers)
    
    def test_toggle_fine_activate_without_fine_type_id_fails(self, auth_headers):
        """PUT /api/events/{id}/fine-toggle without fine_type_id when activating returns 400"""
        # Create event without fine
        event_data = {
            "title": f"TEST_Event_ToggleNoFineType_{uuid.uuid4().hex[:8]}",
            "date": "2026-06-22T18:00:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        try:
            # Try to toggle fine ON without fine_type_id - should fail with 400
            # Note: The endpoint may return 422 for validation error or 400 for business logic error
            toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", json={}, headers=auth_headers)
            assert toggle_response.status_code in [400, 422], f"Expected 400 or 422, got {toggle_response.status_code}"
            print("✓ Fine toggle without fine_type_id when activating returns error")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
    
    def test_toggle_fine_with_invalid_fine_type_id(self, auth_headers):
        """PUT /api/events/{id}/fine-toggle with invalid fine_type_id returns 404"""
        # Create event without fine
        event_data = {
            "title": f"TEST_Event_ToggleInvalid_{uuid.uuid4().hex[:8]}",
            "date": "2026-06-23T18:00:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        try:
            # Try to toggle fine ON with invalid fine_type_id
            toggle_data = {"fine_type_id": "invalid-uuid-that-does-not-exist"}
            toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", json=toggle_data, headers=auth_headers)
            assert toggle_response.status_code == 404, f"Expected 404, got {toggle_response.status_code}"
            print("✓ Fine toggle with invalid fine_type_id returns 404")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)


class TestFineTypesEndpoint:
    """Tests for GET /api/fine-types to verify fine types are available"""
    
    def test_get_fine_types(self, auth_headers):
        """GET /api/fine-types returns list of fine types"""
        response = requests.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get fine types: {response.text}"
        
        fine_types = response.json()
        assert isinstance(fine_types, list), "Response should be a list"
        
        # Check structure of fine types
        if len(fine_types) > 0:
            ft = fine_types[0]
            assert "id" in ft, "Fine type should have id"
            assert "label" in ft, "Fine type should have label"
            assert "amount" in ft or ft.get("amount") is None, "Fine type should have amount field"
        
        print(f"✓ GET /api/fine-types returns {len(fine_types)} fine types")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
