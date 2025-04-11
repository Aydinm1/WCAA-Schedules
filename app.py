import os
import logging
from flask import Flask, render_template, request, jsonify
import requests
from urllib.parse import quote

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Get Airtable credentials from environment variables
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID")
AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY") 
EVENT_TABLE = os.environ.get("EVENT_TABLE", "tblLYaj9vr91ryIH9")  # Using table ID for stability

# Airtable field names - customize these to match your Airtable structure
# Note: Field names are case-sensitive in Airtable
FIELD_PERSON_ASSIGNED = os.environ.get("FIELD_PERSON_ASSIGNED", "WCAA Assigned")  # Updated based on admin page
FIELD_SESSION_NAME = os.environ.get("FIELD_SESSION_NAME", "Event Name")  # Using Event Name instead of the linked record ID
FIELD_ROLE = os.environ.get("FIELD_ROLE", "Role")
FIELD_CONFIRMATION = os.environ.get("FIELD_CONFIRMATION", "Confirmation from Invite?")

@app.route('/')
def index():
    person_id = request.args.get('id')
    if not person_id:
        return render_template('error.html', 
                               message="No person ID provided. Please use a valid link with an ID parameter. Example: /?id=rec9hpttgeJK6o0PY")
    return render_template('index.html', 
                           person_id=person_id,
                           field_session_name=FIELD_SESSION_NAME,
                           field_role=FIELD_ROLE,
                           field_confirmation=FIELD_CONFIRMATION)

@app.route('/admin')
def admin():
    """Admin page to check Airtable configuration"""
    return render_template('admin.html',
                          field_person_assigned=FIELD_PERSON_ASSIGNED,
                          field_session_name=FIELD_SESSION_NAME,
                          field_role=FIELD_ROLE,
                          field_confirmation=FIELD_CONFIRMATION)

@app.route('/api/table-info', methods=['GET'])
def get_table_info():
    """Get metadata about Airtable table (fields, etc.)"""
    try:
        airtable_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{EVENT_TABLE}"
        
        headers = {
            'Authorization': f'Bearer {AIRTABLE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Make request without filtering to get some records and inspect fields
        response = requests.get(airtable_url, headers=headers, params={'maxRecords': 1})
        response.raise_for_status()
        
        return jsonify(response.json())
    except Exception as e:
        logging.error(f"Error fetching table info: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<person_id>', methods=['GET'])
def get_sessions(person_id):
    """Fetch sessions for a specific person from Airtable"""
    try:
        airtable_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{EVENT_TABLE}"
        
        # Log the request details for debugging
        logging.debug(f"Airtable URL: {airtable_url}")
        logging.debug(f"Person ID: {person_id}")
        logging.debug(f"Using fields - Person: {FIELD_PERSON_ASSIGNED}, Session: {FIELD_SESSION_NAME}, Role: {FIELD_ROLE}")
        # No need for filter_formula, as we're filtering in Python code instead
        
        headers = {
            'Authorization': f'Bearer {AIRTABLE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # First, get all records without filtering (up to 100)
        params = {
            'maxRecords': 100
        }
        
        response = requests.get(airtable_url, headers=headers, params=params)
        response.raise_for_status()
        
        all_data = response.json()
        all_records = all_data.get('records', [])
        logging.debug(f"Retrieved {len(all_records)} total records")
        
        # Now filter the records manually to find those that match our person ID
        matching_records = []
        for record in all_records:
            fields = record.get('fields', {})
            # Log every record's fields for debugging
            logging.debug(f"Record ID: {record.get('id')} - Fields: {fields}")
            
            # Get the assigned persons field
            assigned_persons = fields.get(FIELD_PERSON_ASSIGNED, [])
            
            # More thorough debugging of this field
            logging.debug(f"FIELD_PERSON_ASSIGNED value: {assigned_persons}")
            logging.debug(f"Type: {type(assigned_persons)}")
            
            # Try multiple approaches to match
            found_match = False
            
            # Check if this is a list/array and if our person_id is in it
            if isinstance(assigned_persons, list):
                for person in assigned_persons:
                    if isinstance(person, str) and person_id in person:
                        found_match = True
                        break
            # If it's a string, check if it contains our person_id
            elif isinstance(assigned_persons, str) and person_id in assigned_persons:
                found_match = True
                
            # If we found a match, add the record
            if found_match:
                matching_records.append(record)
        
        logging.debug(f"Found {len(matching_records)} matching records for person ID: {person_id}")
        
        # If we have any matching records, log the first one
        if matching_records:
            logging.debug(f"First matching record fields: {matching_records[0].get('fields', {})}")
        
        # Return the filtered data
        result = {
            'records': matching_records
        }
        return jsonify(result)
    
    except Exception as e:
        logging.error(f"Error fetching sessions: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/confirm', methods=['POST'])
def confirm_sessions():
    """Update session confirmations in Airtable"""
    try:
        data = request.json
        airtable_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{EVENT_TABLE}"
        
        headers = {
            'Authorization': f'Bearer {AIRTABLE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        logging.debug(f"Updating confirmations with data: {data}")
        
        response = requests.patch(airtable_url, headers=headers, json=data)
        
        # Log response info for debugging
        logging.debug(f"Response status code: {response.status_code}")
        if response.status_code != 200:
            logging.error(f"Response error body: {response.text}")
            
        response.raise_for_status()
        
        return jsonify({"success": True, "message": "Confirmations updated successfully"})
    except Exception as e:
        logging.error(f"Error updating confirmations: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', message="Page not found"), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', message="Server error. Please try again later."), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)
