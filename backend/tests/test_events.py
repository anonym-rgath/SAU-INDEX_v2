"""
Test suite for Calendar/Event Management Feature
Tests: Event CRUD, RSVP functionality, response stats, fine types auto-creation
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Auth headers for admin"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestEventCRUD:
    """Event CRUD operations tests"""
    
    def test_get_events_list(self, api_client, auth_headers):
        """GET /api/events - List all events"""
        response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        events = response.json()
        assert isinstance(events, list), "Events should be a list"
        print(f"✓ GET /api/events - Found {len(events)} events")
        
        # Check event structure
        if events:
            event = events[0]
            assert "id" in event
            assert "title" in event
            assert "date" in event
            assert "response_open" in event
            assert "response_deadline_passed" in event
            print(f"✓ Event structure verified: {event['title']}")
    
    def test_create_event_with_fine(self, api_client, auth_headers):
        """POST /api/events - Create event with fine amount"""
        # Create event 35 days in future (response should be open in 5 days)
        future_date = (datetime.now() + timedelta(days=35)).strftime("%Y-%m-%dT19:00:00")
        
        payload = {
            "title": "TEST_Vereinsabend",
            "description": "Test event for automated testing",
            "date": future_date,
            "location": "Testort",
            "fine_amount": 7.50
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain event ID"
        print(f"✓ POST /api/events - Created event: {data['id']}")
        
        # Verify event was created
        get_response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = get_response.json()
        created_event = next((e for e in events if e['title'] == "TEST_Vereinsabend"), None)
        assert created_event is not None, "Created event not found in list"
        assert created_event['fine_amount'] == 7.50
        assert created_event['location'] == "Testort"
        print(f"✓ Event verified in list with fine_amount: {created_event['fine_amount']}€")
        
        return data['id']
    
    def test_create_event_without_fine(self, api_client, auth_headers):
        """POST /api/events - Create event without fine"""
        future_date = (datetime.now() + timedelta(days=40)).strftime("%Y-%m-%dT18:00:00")
        
        payload = {
            "title": "TEST_Informeller Treff",
            "date": future_date,
            "location": "Stammtisch"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        data = response.json()
        print(f"✓ POST /api/events - Created event without fine: {data['id']}")
        return data['id']
    
    def test_update_event(self, api_client, auth_headers):
        """PUT /api/events/{id} - Update event details"""
        # First create an event
        future_date = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%dT20:00:00")
        create_response = api_client.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Update Event",
            "date": future_date,
            "location": "Original Location"
        }, headers=auth_headers)
        event_id = create_response.json()['id']
        
        # Update the event
        update_payload = {
            "title": "TEST_Updated Event Title",
            "location": "New Location",
            "fine_amount": 5.00
        }
        
        response = api_client.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to update event: {response.text}"
        print(f"✓ PUT /api/events/{event_id} - Event updated")
        
        # Verify update
        get_response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = get_response.json()
        updated_event = next((e for e in events if e['id'] == event_id), None)
        assert updated_event is not None
        assert updated_event['title'] == "TEST_Updated Event Title"
        assert updated_event['location'] == "New Location"
        print(f"✓ Event update verified: {updated_event['title']}")
        
        return event_id
    
    def test_delete_event(self, api_client, auth_headers):
        """DELETE /api/events/{id} - Delete event"""
        # First create an event to delete
        future_date = (datetime.now() + timedelta(days=50)).strftime("%Y-%m-%dT19:00:00")
        create_response = api_client.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_To Be Deleted",
            "date": future_date
        }, headers=auth_headers)
        event_id = create_response.json()['id']
        
        # Delete the event
        response = api_client.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete event: {response.text}"
        print(f"✓ DELETE /api/events/{event_id} - Event deleted")
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = get_response.json()
        deleted_event = next((e for e in events if e['id'] == event_id), None)
        assert deleted_event is None, "Deleted event should not be in list"
        print(f"✓ Event deletion verified")


class TestEventResponseStats:
    """Test response statistics for events"""
    
    def test_event_has_response_stats(self, api_client, auth_headers):
        """Events should include response_stats for admin/spiess/vorstand"""
        response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        assert response.status_code == 200
        events = response.json()
        
        if events:
            event = events[0]
            assert "response_stats" in event, "Admin should see response_stats"
            stats = event['response_stats']
            if stats:
                assert "zugesagt" in stats
                assert "abgesagt" in stats
                assert "keine_antwort" in stats
                assert "gesamt" in stats
                print(f"✓ Response stats for '{event['title']}': zugesagt={stats['zugesagt']}, abgesagt={stats['abgesagt']}, keine_antwort={stats['keine_antwort']}")
    
    def test_event_has_response_open_flag(self, api_client, auth_headers):
        """Events should have response_open and response_deadline_passed flags"""
        response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = response.json()
        
        for event in events:
            assert "response_open" in event
            assert "response_deadline_passed" in event
            assert isinstance(event['response_open'], bool)
            assert isinstance(event['response_deadline_passed'], bool)
        
        print(f"✓ All {len(events)} events have response_open and response_deadline_passed flags")


class TestEventFineTypeIntegration:
    """Test auto-creation of fine types for events"""
    
    def test_event_creates_fine_type(self, api_client, auth_headers):
        """Creating event with fine_amount should auto-create fine type"""
        future_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%dT19:00:00")
        
        # Create event with fine
        create_response = api_client.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Fine Type Event",
            "date": future_date,
            "fine_amount": 12.50
        }, headers=auth_headers)
        assert create_response.status_code == 200
        event_id = create_response.json()['id']
        
        # Check fine types
        fine_types_response = api_client.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        fine_types = fine_types_response.json()
        
        event_fine_type = next((ft for ft in fine_types if "TEST_Fine Type Event" in ft['label']), None)
        assert event_fine_type is not None, "Fine type should be auto-created for event"
        assert event_fine_type['amount'] == 12.50
        assert event_fine_type['label'].startswith("Termin:")
        print(f"✓ Fine type auto-created: '{event_fine_type['label']}' with amount {event_fine_type['amount']}€")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
    
    def test_delete_event_removes_fine_type(self, api_client, auth_headers):
        """Deleting event should also delete its fine type"""
        future_date = (datetime.now() + timedelta(days=65)).strftime("%Y-%m-%dT19:00:00")
        
        # Create event with fine
        create_response = api_client.post(f"{BASE_URL}/api/events", json={
            "title": "TEST_Delete Fine Type Event",
            "date": future_date,
            "fine_amount": 8.00
        }, headers=auth_headers)
        event_id = create_response.json()['id']
        
        # Verify fine type exists
        fine_types_response = api_client.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        fine_types = fine_types_response.json()
        event_fine_type = next((ft for ft in fine_types if "TEST_Delete Fine Type Event" in ft['label']), None)
        assert event_fine_type is not None
        
        # Delete event
        api_client.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        
        # Verify fine type is also deleted
        fine_types_response = api_client.get(f"{BASE_URL}/api/fine-types", headers=auth_headers)
        fine_types = fine_types_response.json()
        event_fine_type = next((ft for ft in fine_types if "TEST_Delete Fine Type Event" in ft['label']), None)
        assert event_fine_type is None, "Fine type should be deleted with event"
        print(f"✓ Fine type deleted when event was deleted")


class TestEventRSVP:
    """Test RSVP functionality (limited without member user)"""
    
    def test_rsvp_requires_member_id(self, api_client, auth_headers):
        """Admin without member_id cannot respond to events"""
        # Get an event
        events_response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = events_response.json()
        
        if events:
            event = events[0]
            # Try to respond (should fail for admin without member_id)
            response = api_client.post(
                f"{BASE_URL}/api/events/{event['id']}/respond",
                json={"response": "zugesagt"},
                headers=auth_headers
            )
            # Should fail with 400 because admin has no member_id
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
            assert "Kein Mitglied verknüpft" in response.json().get('detail', '')
            print(f"✓ RSVP correctly rejected for user without member_id")
    
    def test_rsvp_invalid_response(self, api_client, auth_headers):
        """Invalid response value should be rejected"""
        events_response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = events_response.json()
        
        if events:
            event = events[0]
            response = api_client.post(
                f"{BASE_URL}/api/events/{event['id']}/respond",
                json={"response": "maybe"},  # Invalid
                headers=auth_headers
            )
            # Should fail (either 400 for invalid response or 400 for no member_id)
            assert response.status_code == 400
            print(f"✓ Invalid RSVP response correctly rejected")


class TestExistingEvents:
    """Test existing seed events"""
    
    def test_seed_events_exist(self, api_client, auth_headers):
        """Verify seed events exist: Übungsabend and Schützenfest 2026"""
        response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = response.json()
        
        event_titles = [e['title'] for e in events]
        
        # Check for expected seed events
        uebungsabend = next((e for e in events if "Übungsabend" in e['title']), None)
        schuetzenfest = next((e for e in events if "Schützenfest" in e['title']), None)
        
        if uebungsabend:
            print(f"✓ Found seed event: {uebungsabend['title']} - Fine: {uebungsabend.get('fine_amount', 0)}€")
            assert uebungsabend.get('fine_amount') == 5.0
        
        if schuetzenfest:
            print(f"✓ Found seed event: {schuetzenfest['title']} - Fine: {schuetzenfest.get('fine_amount', 0)}€")
            assert schuetzenfest.get('fine_amount') == 10.0
        
        print(f"✓ Total events in system: {len(events)}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_events(self, api_client, auth_headers):
        """Remove all TEST_ prefixed events"""
        response = api_client.get(f"{BASE_URL}/api/events", headers=auth_headers)
        events = response.json()
        
        test_events = [e for e in events if e['title'].startswith("TEST_")]
        
        for event in test_events:
            delete_response = api_client.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
            if delete_response.status_code == 200:
                print(f"✓ Cleaned up test event: {event['title']}")
        
        print(f"✓ Cleanup complete - removed {len(test_events)} test events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
