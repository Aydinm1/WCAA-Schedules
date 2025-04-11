import os
import logging
from flask import Flask, render_template, request, jsonify
import requests
from urllib.parse import quote

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Get Airtable credentials from environment variables with fallbacks for development
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "app7lzVO1a8hSpV95")
AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY", "pat1pfDE7smhUjHNC")
EVENT_TABLE = os.environ.get("EVENT_TABLE", "Event Participation")

@app.route('/')
def index():
    person_id = request.args.get('id')
    if not person_id:
        return render_template('error.html', 
                               message="No person ID provided. Please use a valid link with an ID parameter.")
    return render_template('index.html', person_id=person_id)

@app.route('/api/sessions/<person_id>', methods=['GET'])
def get_sessions(person_id):
    """Fetch sessions for a specific person from Airtable"""
    try:
        airtable_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{EVENT_TABLE}"
        filter_formula = f"{{Person Assigned}}='{person_id}'"
        
        headers = {
            'Authorization': f'Bearer {AIRTABLE_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'filterByFormula': filter_formula
        }
        
        response = requests.get(airtable_url, headers=headers, params=params)
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
