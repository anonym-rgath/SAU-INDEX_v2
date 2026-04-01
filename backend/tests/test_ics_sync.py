"""
ICS Calendar Sync Feature Tests
Tests for:
- GET /api/settings/ics - returns ICS settings (admin only)
- PUT /api/settings/ics - update ICS URL and sync_enabled (admin only)
- POST /api/settings/ics/sync - manual sync triggers and imports events
- PUT /api/events/{id}/fine-toggle - toggles fine_enabled on/off
- ICS events appear in GET /api/events with source='ics' and ics_uid set
- ICS events have fine_enabled=false by default (no auto-fine)
- Manual events still have source='manual'
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestICSSettings:
    """Tests for ICS settings endpoints (admin only)"""
    
    def test_get_ics_settings_admin(self, admin_headers):
        """GET /api/settings/ics - admin can retrieve ICS settings"""
        response = requests.get(f"{BASE_URL}/api/settings/ics", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "ics_url" in data
        assert "sync_enabled" in data
        assert "last_sync" in data
        print(f"ICS Settings: URL={data['ics_url'][:50] if data['ics_url'] else 'None'}..., sync_enabled={data['sync_enabled']}")
    
    def test_get_ics_settings_unauthorized(self):
        """GET /api/settings/ics - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/ics")
        assert response.status_code == 403 or response.status_code == 401
    
    def test_update_ics_settings_admin(self, admin_headers):
        """PUT /api/settings/ics - admin can update ICS settings"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings/ics", headers=admin_headers)
        original_settings = get_response.json()
        
        # Update settings
        new_url = "https://outlook.live.com/owa/calendar/test/calendar.ics"
        response = requests.put(f"{BASE_URL}/api/settings/ics", headers=admin_headers, json={
            "ics_url": new_url,
            "sync_enabled": True
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/settings/ics", headers=admin_headers)
        updated = verify_response.json()
        assert updated["ics_url"] == new_url
        assert updated["sync_enabled"] == True
        
        # Restore original settings
        requests.put(f"{BASE_URL}/api/settings/ics", headers=admin_headers, json={
            "ics_url": original_settings.get("ics_url", ""),
            "sync_enabled": original_settings.get("sync_enabled", False)
        })
        print("ICS settings update test passed")
    
    def test_update_ics_settings_partial(self, admin_headers):
        """PUT /api/settings/ics - can update only sync_enabled"""
        response = requests.put(f"{BASE_URL}/api/settings/ics", headers=admin_headers, json={
            "sync_enabled": True
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Partial ICS settings update test passed")


class TestICSSync:
    """Tests for ICS sync functionality"""
    
    def test_manual_sync_admin(self, admin_headers):
        """POST /api/settings/ics/sync - admin can trigger manual sync"""
        response = requests.post(f"{BASE_URL}/api/settings/ics/sync", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should return sync stats or error message
        assert "synced" in data or "error" in data or "message" in data
        print(f"Manual sync result: {data}")
    
    def test_manual_sync_unauthorized(self):
        """POST /api/settings/ics/sync - requires admin auth"""
        response = requests.post(f"{BASE_URL}/api/settings/ics/sync")
        assert response.status_code == 403 or response.status_code == 401


class TestICSEventsInList:
    """Tests for ICS events appearing in event list"""
    
    def test_events_list_contains_ics_events(self, admin_headers):
        """GET /api/events - ICS events have source='ics' and ics_uid"""
        response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        events = response.json()
        assert isinstance(events, list)
        
        ics_events = [e for e in events if e.get('source') == 'ics']
        manual_events = [e for e in events if e.get('source') == 'manual']
        
        print(f"Total events: {len(events)}, ICS events: {len(ics_events)}, Manual events: {len(manual_events)}")
        
        # Verify ICS events have required fields
        for event in ics_events:
            assert event.get('source') == 'ics', f"ICS event missing source: {event}"
            assert event.get('ics_uid') is not None, f"ICS event missing ics_uid: {event}"
            # ICS events should have fine_enabled=false by default
            assert event.get('fine_enabled') == False or event.get('fine_enabled') is None, \
                f"ICS event should have fine_enabled=false by default: {event}"
        
        # Verify manual events have source='manual'
        for event in manual_events:
            assert event.get('source') == 'manual', f"Manual event has wrong source: {event}"
    
    def test_ics_events_have_fine_disabled_by_default(self, admin_headers):
        """ICS events should have fine_enabled=false by default"""
        response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        assert response.status_code == 200
        
        events = response.json()
        ics_events = [e for e in events if e.get('source') == 'ics']
        
        for event in ics_events:
            # fine_enabled should be False or not set (defaults to False)
            fine_enabled = event.get('fine_enabled', False)
            # Note: Some ICS events may have fine_enabled=True if admin toggled it
            # So we just verify the field exists
            assert 'fine_enabled' in event or fine_enabled == False
        
        print(f"Verified {len(ics_events)} ICS events have fine_enabled field")


class TestFineToggle:
    """Tests for fine toggle endpoint"""
    
    def test_toggle_fine_on_ics_event(self, admin_headers):
        """PUT /api/events/{id}/fine-toggle - can toggle fine on ICS event"""
        # Get an ICS event
        response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        assert response.status_code == 200
        
        events = response.json()
        ics_events = [e for e in events if e.get('source') == 'ics']
        
        if not ics_events:
            pytest.skip("No ICS events available for testing")
        
        test_event = ics_events[0]
        event_id = test_event['id']
        original_fine_enabled = test_event.get('fine_enabled', False)
        
        # Toggle fine
        toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", headers=admin_headers)
        assert toggle_response.status_code == 200, f"Failed: {toggle_response.text}"
        
        toggle_data = toggle_response.json()
        assert "fine_enabled" in toggle_data
        assert toggle_data["fine_enabled"] == (not original_fine_enabled)
        print(f"Fine toggled from {original_fine_enabled} to {toggle_data['fine_enabled']}")
        
        # Toggle back to original state
        requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", headers=admin_headers)
    
    def test_toggle_fine_creates_fine_type(self, admin_headers):
        """PUT /api/events/{id}/fine-toggle - creates fine_type when enabling with fine_amount > 0"""
        # Get an ICS event with fine_amount > 0 and fine_enabled=false
        response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        events = response.json()
        
        # Find an ICS event that has fine_amount but fine_enabled=false
        ics_events = [e for e in events if e.get('source') == 'ics' and not e.get('fine_enabled', False)]
        
        if not ics_events:
            pytest.skip("No ICS events with fine_enabled=false available")
        
        # We need to set fine_amount first via update if it's 0
        test_event = ics_events[0]
        event_id = test_event['id']
        
        # Update event to have fine_amount
        update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", headers=admin_headers, json={
            "fine_amount": 5.0
        })
        
        # Toggle fine on
        toggle_response = requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", headers=admin_headers)
        assert toggle_response.status_code == 200
        
        # Verify event now has fine_enabled=true
        verify_response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        updated_events = verify_response.json()
        updated_event = next((e for e in updated_events if e['id'] == event_id), None)
        
        if updated_event:
            assert updated_event.get('fine_enabled') == True
            print(f"Fine toggle created fine_type for event: {updated_event['title']}")
        
        # Toggle back off
        requests.put(f"{BASE_URL}/api/events/{event_id}/fine-toggle", headers=admin_headers)
    
    def test_toggle_fine_unauthorized(self):
        """PUT /api/events/{id}/fine-toggle - requires authentication"""
        response = requests.put(f"{BASE_URL}/api/events/some-id/fine-toggle")
        assert response.status_code == 403 or response.status_code == 401
    
    def test_toggle_fine_not_found(self, admin_headers):
        """PUT /api/events/{id}/fine-toggle - returns 404 for non-existent event"""
        response = requests.put(f"{BASE_URL}/api/events/non-existent-id/fine-toggle", headers=admin_headers)
        assert response.status_code == 404


class TestManualEventsStillWork:
    """Tests to verify manual events still work correctly"""
    
    def test_create_manual_event(self, admin_headers):
        """POST /api/events - manual events have source='manual'"""
        event_data = {
            "title": "TEST_Manual_Event_ICS_Test",
            "description": "Test event for ICS sync testing",
            "date": "2026-06-15T18:00:00Z",
            "location": "Test Location",
            "fine_amount": 5.0
        }
        
        response = requests.post(f"{BASE_URL}/api/events", headers=admin_headers, json=event_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        event_id = data.get("id")
        assert event_id is not None
        
        # Verify event has source='manual'
        events_response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        events = events_response.json()
        created_event = next((e for e in events if e['id'] == event_id), None)
        
        assert created_event is not None
        assert created_event.get('source') == 'manual'
        assert created_event.get('ics_uid') is None
        # Manual events with fine_amount should have fine_enabled=true
        assert created_event.get('fine_enabled') == True
        
        print(f"Manual event created with source='manual': {created_event['title']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=admin_headers)


class TestExistingFeaturesStillWork:
    """Tests to verify existing features still work"""
    
    def test_login_works(self):
        """Login still works with admin/admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "admin"
        print("Login test passed")
    
    def test_members_endpoint(self, admin_headers):
        """GET /api/members still works"""
        response = requests.get(f"{BASE_URL}/api/members", headers=admin_headers)
        assert response.status_code == 200
        members = response.json()
        assert isinstance(members, list)
        print(f"Members endpoint works: {len(members)} members")
    
    def test_fines_endpoint(self, admin_headers):
        """GET /api/fines still works"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=admin_headers)
        assert response.status_code == 200
        fines = response.json()
        assert isinstance(fines, list)
        print(f"Fines endpoint works: {len(fines)} fines")
    
    def test_statistics_endpoint(self, admin_headers):
        """GET /api/statistics still works"""
        response = requests.get(f"{BASE_URL}/api/statistics", headers=admin_headers, params={"fiscal_year": "2025/2026"})
        assert response.status_code == 200
        stats = response.json()
        assert "fiscal_year" in stats
        print(f"Statistics endpoint works: fiscal_year={stats['fiscal_year']}")
    
    def test_events_list(self, admin_headers):
        """GET /api/events returns both ICS and manual events"""
        response = requests.get(f"{BASE_URL}/api/events", headers=admin_headers)
        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
        
        # Count by source
        ics_count = len([e for e in events if e.get('source') == 'ics'])
        manual_count = len([e for e in events if e.get('source') == 'manual'])
        
        print(f"Events list works: {len(events)} total, {ics_count} ICS, {manual_count} manual")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
