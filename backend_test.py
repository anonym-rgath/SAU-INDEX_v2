import requests
import sys
import json
from datetime import datetime

class SchützenzugAPITester:
    def __init__(self, base_url="https://fines-tracker-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_member_id = None
        self.created_finetype_id = None
        self.created_fine_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth(self):
        """Test authentication endpoints"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test login with correct password
        success, response = self.run_test(
            "Login with admin123",
            "POST",
            "auth/login",
            200,
            data={"password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"Token received: {self.token[:50]}...")
            return True
        
        # Test login with wrong password
        self.run_test(
            "Login with wrong password",
            "POST", 
            "auth/login",
            401,
            data={"password": "wrongpassword"}
        )
        
        return False

    def test_members(self):
        """Test member CRUD operations"""
        print("\n=== MEMBER TESTS ===")
        
        # Get all members
        success, response = self.run_test(
            "Get all members",
            "GET",
            "members",
            200
        )
        
        # Create a new member
        success, response = self.run_test(
            "Create member",
            "POST",
            "members",
            200,
            data={"name": "Test Mitglied"}
        )
        if success and 'id' in response:
            self.created_member_id = response['id']
            print(f"Created member ID: {self.created_member_id}")
        
        # Update member
        if self.created_member_id:
            self.run_test(
                "Update member",
                "PUT",
                f"members/{self.created_member_id}",
                200,
                data={"name": "Updated Test Mitglied"}
            )

    def test_fine_types(self):
        """Test fine type CRUD operations"""
        print("\n=== FINE TYPE TESTS ===")
        
        # Get all fine types
        self.run_test(
            "Get all fine types",
            "GET",
            "fine-types",
            200
        )
        
        # Create a new fine type
        success, response = self.run_test(
            "Create fine type",
            "POST",
            "fine-types", 
            200,
            data={"label": "Test Strafe", "amount": 5.0}
        )
        if success and 'id' in response:
            self.created_finetype_id = response['id']
            print(f"Created fine type ID: {self.created_finetype_id}")
        
        # Update fine type
        if self.created_finetype_id:
            self.run_test(
                "Update fine type",
                "PUT",
                f"fine-types/{self.created_finetype_id}",
                200,
                data={"label": "Updated Test Strafe", "amount": 10.0}
            )

    def test_fines(self):
        """Test fine CRUD operations"""
        print("\n=== FINE TESTS ===")
        
        # Get all fines
        self.run_test(
            "Get all fines",
            "GET",
            "fines",
            200
        )
        
        # Get fines by year
        current_year = datetime.now().year
        self.run_test(
            f"Get fines for {current_year}",
            "GET",
            f"fines?year={current_year}",
            200
        )
        
        # Create a new fine (requires member and fine type)
        if self.created_member_id and self.created_finetype_id:
            success, response = self.run_test(
                "Create fine",
                "POST",
                "fines",
                200,
                data={
                    "member_id": self.created_member_id,
                    "fine_type_id": self.created_finetype_id,
                    "amount": 15.0,
                    "notes": "Test fine"
                }
            )
            if success and 'id' in response:
                self.created_fine_id = response['id']
                print(f"Created fine ID: {self.created_fine_id}")
        
        # Update fine
        if self.created_fine_id:
            self.run_test(
                "Update fine",
                "PUT",
                f"fines/{self.created_fine_id}",
                200,
                data={"amount": 20.0, "notes": "Updated test fine"}
            )

    def test_statistics(self):
        """Test statistics endpoint"""
        print("\n=== STATISTICS TESTS ===")
        
        current_year = datetime.now().year
        self.run_test(
            f"Get statistics for {current_year}",
            "GET",
            f"statistics/{current_year}",
            200
        )

    def test_years(self):
        """Test years endpoint"""
        print("\n=== YEARS TESTS ===")
        
        self.run_test(
            "Get available years",
            "GET",
            "years",
            200
        )

    def cleanup(self):
        """Clean up created test data"""
        print("\n=== CLEANUP ===")
        
        # Delete created fine
        if self.created_fine_id:
            self.run_test(
                "Delete fine",
                "DELETE",
                f"fines/{self.created_fine_id}",
                200
            )
        
        # Delete created fine type
        if self.created_finetype_id:
            self.run_test(
                "Delete fine type", 
                "DELETE",
                f"fine-types/{self.created_finetype_id}",
                200
            )
        
        # Delete created member
        if self.created_member_id:
            self.run_test(
                "Delete member",
                "DELETE",
                f"members/{self.created_member_id}",
                200
            )

def main():
    # Setup
    tester = SchützenzugAPITester()
    
    # Run authentication tests first
    if not tester.test_auth():
        print("❌ Authentication failed, stopping tests")
        return 1
    
    # Run all API tests
    tester.test_members()
    tester.test_fine_types()
    tester.test_fines()
    tester.test_statistics()
    tester.test_years()
    
    # Cleanup test data
    tester.cleanup()
    
    # Print results
    print(f"\n📊 Backend API Tests: {tester.tests_passed}/{tester.tests_run} passed")
    
    # Calculate success rate
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed >= (tester.tests_run * 0.8) else 1

if __name__ == "__main__":
    sys.exit(main())