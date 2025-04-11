document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    const confirmationForm = document.getElementById('confirmationForm');
    const loadingElement = document.getElementById('loading');
    const errorMessageElement = document.getElementById('errorMessage');
    const noSessionsElement = document.getElementById('noSessions');
    const sessionListElement = document.getElementById('sessionList');
    const successMessageElement = document.getElementById('successMessage');
    const personId = document.getElementById('personId').value;
    
    // Function to update session card styling based on selection
    function updateSessionCardStyle(select) {
        const card = select.closest('.session-card');
        
        // Reset classes
        card.classList.remove('confirmed', 'declined');
        
        // Add appropriate class based on selection
        if (select.value === 'Yes') {
            card.classList.add('confirmed');
        } else if (select.value === 'No') {
            card.classList.add('declined');
        }
    }
    
    // Function to load sessions from the server
    async function loadSessions() {
        try {
            const response = await fetch(`/api/sessions/${personId}`);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide loading spinner
            loadingElement.classList.add('d-none');
            
            // Check if we have sessions
            if (!data.records || data.records.length === 0) {
                noSessionsElement.classList.remove('d-none');
                return;
            }
            
            // Show the form
            confirmationForm.classList.remove('d-none');
            
            // Clear existing sessions
            sessionListElement.innerHTML = '';
            
            // Get field names from hidden inputs
            const fieldSessionName = document.getElementById('fieldSessionName').value;
            const fieldRole = document.getElementById('fieldRole').value;
            const fieldConfirmation = document.getElementById('fieldConfirmation').value;
            
            // Add each session to the list
            data.records.forEach(record => {
                const sessionName = record.fields[fieldSessionName] || 'Unnamed Session';
                const role = record.fields[fieldRole] || 'Participant';
                const confirmed = record.fields[fieldConfirmation] || '';
                
                // Create session card
                const sessionCard = document.createElement('div');
                sessionCard.className = 'card session-card p-3';
                if (confirmed === 'Yes') {
                    sessionCard.classList.add('confirmed');
                } else if (confirmed === 'No') {
                    sessionCard.classList.add('declined');
                }
                
                // Create session content
                sessionCard.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="mb-1">${sessionName}</h5>
                            <p class="mb-2 text-muted">
                                <span data-feather="user"></span> ${role}
                            </p>
                        </div>
                        <div class="form-group">
                            <label for="confirmation-${record.id}" class="form-label">Confirmation:</label>
                            <select class="form-select confirmation-select" 
                                    id="confirmation-${record.id}" 
                                    data-record-id="${record.id}">
                                <option value="" ${confirmed === '' ? 'selected' : ''}>Select...</option>
                                <option value="Yes" ${confirmed === 'Yes' ? 'selected' : ''}>Yes</option>
                                <option value="No" ${confirmed === 'No' ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                    </div>
                `;
                
                sessionListElement.appendChild(sessionCard);
            });
            
            // Initialize feather icons
            feather.replace();
            
            // Add event listeners to the select elements
            document.querySelectorAll('.confirmation-select').forEach(select => {
                select.addEventListener('change', function() {
                    updateSessionCardStyle(this);
                });
            });
            
        } catch (error) {
            console.error('Error loading sessions:', error);
            loadingElement.classList.add('d-none');
            errorMessageElement.classList.remove('d-none');
        }
    }
    
    // Load sessions on page load
    loadSessions();
    
    // Handle form submission
    confirmationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get field name for confirmation
        const fieldConfirmation = document.getElementById('fieldConfirmation').value;
        
        // Gather all confirmation data
        const selects = document.querySelectorAll('.confirmation-select');
        const updates = [];
        
        selects.forEach(select => {
            if (select.value) {  // Only submit if a selection was made
                // Create a fields object with the dynamic field name
                const fields = {};
                fields[fieldConfirmation] = select.value;
                
                updates.push({
                    id: select.dataset.recordId,
                    fields: fields
                });
            }
        });
        
        // If no updates, show a message
        if (updates.length === 0) {
            alert('Please make at least one confirmation selection.');
            return;
        }
        
        try {
            // Disable the submit button and show loading state
            const submitButton = confirmationForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Submitting...
            `;
            
            // Submit the data
            const response = await fetch('/api/sessions/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: updates })
            });
            
            // Reset button state
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error submitting confirmations');
            }
            
            // Show success message
            successMessageElement.classList.remove('d-none');
            successMessageElement.classList.add('fade-in-out');
            
            // Reload sessions after 3 seconds
            setTimeout(() => {
                successMessageElement.classList.add('d-none');
                loadSessions();
            }, 3000);
            
        } catch (error) {
            console.error('Error submitting confirmations:', error);
            alert(`Error: ${error.message}`);
        }
    });
});
