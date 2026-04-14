"""
Test suite for Notification System
Tests:
- GET /api/notifications - returns notifications for logged-in member
- GET /api/notifications/unread-count - returns correct unread count
- PUT /api/notifications/{id}/read - marks single notification as read
- PUT /api/notifications/read-all - marks all notifications as read
- Creating a fine via POST /api/fines automatically creates a notification
- Admin (no member_id) gets empty array from GET /api/notifications
- Notifications are isolated per member
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
ROBIN1_CREDS = {"username": "Robin1", "password": "Test1234"}  # member_id: 93fdedf2-acf3-4951-b5de-d8f9827ca7a0
ROBIN1_MEMBER_ID = "93fdedf2-acf3-4951-b5de-d8f9827ca7a0"
HENRIK_MEMBER_ID = "8470c0d7-9ea2-4ece-95b1-a247cb1b17e2"
FINE_TYPE_ID = "80b8cd8e-df44-4622-92d5-d3e1fe90f0bf"  # 'Quatsch gemacht' with amount 1.0


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def robin1_token():
    """Get Robin1 (member) authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ROBIN1_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Robin1 authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def robin1_headers(robin1_token):
    """Headers with Robin1 auth"""
    return {"Authorization": f"Bearer {robin1_token}", "Content-Type": "application/json"}


class TestNotificationEndpoints:
    """Test notification API endpoints"""
    
    def test_admin_gets_empty_notifications(self, admin_headers):
        """Admin (no member_id) should get empty array from GET /api/notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, f"Admin should get empty notifications, got {len(data)}"
        print("✓ Admin gets empty notifications array")
    
    def test_admin_gets_zero_unread_count(self, admin_headers):
        """Admin should get 0 unread count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=admin_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert data["count"] == 0, f"Admin should have 0 unread, got {data['count']}"
        print("✓ Admin gets 0 unread count")
    
    def test_member_gets_notifications(self, robin1_headers):
        """Member should get their notifications sorted by newest first"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Robin1 has {len(data)} notifications")
        
        # Verify notification structure if any exist
        if len(data) > 0:
            notif = data[0]
            assert "id" in notif, "Notification should have 'id'"
            assert "title" in notif, "Notification should have 'title'"
            assert "description" in notif, "Notification should have 'description'"
            assert "read" in notif, "Notification should have 'read' status"
            assert "created_at" in notif, "Notification should have 'created_at'"
            assert "member_id" in notif, "Notification should have 'member_id'"
            assert notif["member_id"] == ROBIN1_MEMBER_ID, "Notification should belong to Robin1"
            print(f"  - Latest: {notif['title']} (read: {notif['read']})")
    
    def test_member_gets_unread_count(self, robin1_headers):
        """Member should get their unread count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=robin1_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert isinstance(data["count"], int), "Count should be an integer"
        print(f"✓ Robin1 has {data['count']} unread notifications")
        return data["count"]


class TestNotificationMarkAsRead:
    """Test marking notifications as read"""
    
    def test_mark_single_notification_as_read(self, robin1_headers):
        """Mark a single notification as read"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        assert response.status_code == 200
        notifications = response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to mark as read")
        
        # Find an unread notification
        unread = [n for n in notifications if not n.get("read")]
        if len(unread) == 0:
            print("✓ No unread notifications to mark (all already read)")
            return
        
        notif_id = unread[0]["id"]
        
        # Mark as read
        response = requests.put(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=robin1_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify it's now read
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        notifications = response.json()
        marked_notif = next((n for n in notifications if n["id"] == notif_id), None)
        assert marked_notif is not None, "Notification should still exist"
        assert marked_notif["read"] == True, "Notification should be marked as read"
        print(f"✓ Notification {notif_id} marked as read")
    
    def test_mark_all_notifications_as_read(self, robin1_headers):
        """Mark all notifications as read"""
        response = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=robin1_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify unread count is 0
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=robin1_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0, f"Unread count should be 0 after mark-all, got {data['count']}"
        print("✓ All notifications marked as read")
    
    def test_mark_nonexistent_notification_returns_404(self, robin1_headers):
        """Marking a non-existent notification should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/notifications/{fake_id}/read", headers=robin1_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent notification returns 404")


class TestFineCreatesNotification:
    """Test that creating a fine automatically creates a notification"""
    
    def test_create_fine_creates_notification(self, admin_headers, robin1_headers):
        """Creating a fine should create a notification for the target member"""
        # Get initial notification count for Robin1
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        assert response.status_code == 200
        initial_count = len(response.json())
        
        # Get initial unread count
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=robin1_headers)
        initial_unread = response.json()["count"]
        
        # Create a fine for Robin1 using admin
        fine_data = {
            "member_id": ROBIN1_MEMBER_ID,
            "fine_type_id": FINE_TYPE_ID,
            "amount": 1.0,
            "notes": f"TEST_notification_test_{uuid.uuid4()}"
        }
        response = requests.post(f"{BASE_URL}/api/fines", json=fine_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create fine: {response.status_code} - {response.text}"
        created_fine = response.json()
        print(f"✓ Fine created: {created_fine['id']}")
        
        # Verify notification was created for Robin1
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        assert response.status_code == 200
        notifications = response.json()
        
        assert len(notifications) > initial_count, "New notification should be created"
        
        # Check the latest notification
        latest = notifications[0]  # Should be sorted by newest first
        assert latest["type"] == "fine", f"Notification type should be 'fine', got {latest.get('type')}"
        assert "Neue Strafe" in latest["title"], f"Title should contain 'Neue Strafe', got {latest['title']}"
        assert latest["read"] == False, "New notification should be unread"
        print(f"✓ Notification created: {latest['title']}")
        
        # Verify unread count increased
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=robin1_headers)
        new_unread = response.json()["count"]
        assert new_unread > initial_unread, f"Unread count should increase, was {initial_unread}, now {new_unread}"
        print(f"✓ Unread count increased from {initial_unread} to {new_unread}")
        
        # Cleanup: Delete the test fine
        fine_id = created_fine["id"]
        response = requests.delete(f"{BASE_URL}/api/fines/{fine_id}", headers=admin_headers)
        if response.status_code == 200:
            print(f"✓ Test fine {fine_id} cleaned up")


class TestNotificationIsolation:
    """Test that notifications are isolated per member"""
    
    def test_member_cannot_see_other_member_notifications(self, admin_headers, robin1_headers):
        """Robin1 should not see Henrik's notifications"""
        # Create a fine for Henrik (different member)
        fine_data = {
            "member_id": HENRIK_MEMBER_ID,
            "fine_type_id": FINE_TYPE_ID,
            "amount": 1.0,
            "notes": f"TEST_isolation_test_{uuid.uuid4()}"
        }
        response = requests.post(f"{BASE_URL}/api/fines", json=fine_data, headers=admin_headers)
        
        if response.status_code != 200:
            pytest.skip(f"Could not create fine for Henrik: {response.status_code} - {response.text}")
        
        created_fine = response.json()
        print(f"✓ Fine created for Henrik: {created_fine['id']}")
        
        # Get Robin1's notifications
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        assert response.status_code == 200
        robin1_notifications = response.json()
        
        # Verify none of Robin1's notifications belong to Henrik
        for notif in robin1_notifications:
            assert notif["member_id"] == ROBIN1_MEMBER_ID, f"Robin1 should only see own notifications, found member_id: {notif['member_id']}"
        
        print(f"✓ Robin1 only sees own notifications ({len(robin1_notifications)} total)")
        
        # Cleanup
        fine_id = created_fine["id"]
        response = requests.delete(f"{BASE_URL}/api/fines/{fine_id}", headers=admin_headers)
        if response.status_code == 200:
            print(f"✓ Test fine {fine_id} cleaned up")


class TestNotificationPermissions:
    """Test notification permission handling"""
    
    def test_admin_cannot_mark_member_notification_as_read(self, admin_headers, robin1_headers):
        """Admin should not be able to mark a member's notification as read (no member_id)"""
        # Get Robin1's notifications
        response = requests.get(f"{BASE_URL}/api/notifications", headers=robin1_headers)
        notifications = response.json()
        
        if len(notifications) == 0:
            pytest.skip("No notifications to test with")
        
        notif_id = notifications[0]["id"]
        
        # Try to mark as read with admin (should fail - admin has no member_id)
        response = requests.put(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=admin_headers)
        # This should return 403 or 404 since admin has no member_id
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"
        print(f"✓ Admin cannot mark member's notification as read (got {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
