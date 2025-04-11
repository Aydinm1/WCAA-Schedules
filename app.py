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
FIELD_PERSON_ASSIGNED = os.environ.get("FIELD_PERSON_ASSIGNED", "Person")  # Updated field name
FIELD_SESSION_NAME = os.environ.get("FIELD_SESSION_NAME", "Retreat/Festival Sessions")
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
        filter_formula = f"{{{FIELD_PERSON_ASSIGNED}}}='{person_id}'"
        
        # Log the request details for debugging (without exposing full API key)
        logging.debug(f"Airtable URL: {airtable_url}")
        logging.debug(f"Person ID: {person_id}")
        logging.debug(f"API Key (first 4 chars): {AIRTABLE_API_KEY[:4] if AIRTABLE_API_KEY else 'None'}...")
        logging.debug(f"Base ID: {AIRTABLE_BASE_ID}")
        logging.debug(f"Filter formula: {filter_formula}")
        logging.debug(f"Person Assigned field: {FIELD_PERSON_ASSIGNED}")
        logging.debug(f"Session Name field: {FIELD_SESSION_NAME}")
        logging.debug(f"Role field: {FIELD_ROLE}")
        logging.debug(f"Confirmation field: {FIELD_CONFIRMATION}")
        
        headers = {
            'Authorization': f'Bearer {AIRTABLE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'filterByFormula': filter_formula
        }
        
        response = requests.get(airtable_url, headers=headers, params=params)
        
        # Log more details about the response
        logging.debug(f"Response status code: {response.status_code}")
        if response.status_code != 200:
            logging.error(f"Response error body: {response.text}")
        
        response.raise_for_status()
        
        return jsonify(response.json())
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
        
        response = requests.patch(airtable_url, headers=headers, json=data)
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
