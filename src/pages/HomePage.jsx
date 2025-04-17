import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function HomePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [participantName, setParticipantName] = useState('Participant');

  const personId = new URLSearchParams(window.location.search).get('id');
  const fieldSessionName = 'Event Name';
  const fieldRole = 'Role';
  const fieldConfirmation = 'Confirmation from Invite?';

  useEffect(() => {
    if (!personId) {
      setError('No person ID provided. Use ?id=recordId in the URL.');
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        const res = await axios.get(
          `https://api.airtable.com/v0/${import.meta.env.VITE_AIRTABLE_BASE_ID}/tblLYaj9vr91ryIH9`,
          {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}` },
            params: { maxRecords: 100 },
          }
        );

        const matches = res.data.records.filter((record) => {
          const assigned = record.fields['WCAA Assigned'];
          return Array.isArray(assigned) && assigned.includes(personId);
        });

        if (matches.length > 0 && matches[0].fields['Name (from WCAA Assigned)']) {
          setParticipantName(matches[0].fields['Name (from WCAA Assigned)']);
        }

        setSessions(matches);
      } catch (err) {
        setError('Failed to load sessions.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [personId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updates = sessions
      .map((s) => {
        const selectEl = document.getElementById(`confirmation-${s.id}`);
        return { id: s.id, fields: { [fieldConfirmation]: selectEl.value } };
      })
      .filter((update) => update.fields[fieldConfirmation] !== '');

    if (updates.length === 0) return alert('Please make at least one selection before submitting.');

    try {
      await axios.patch(
        `https://api.airtable.com/v0/${import.meta.env.VITE_AIRTABLE_BASE_ID}/tblLYaj9vr91ryIH9`,
        { records: updates },
        { headers: { Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' } }
      );

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Error submitting responses. Please try again.');
      console.error(err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    });
  };

  if (loading)
    return (
      <div className="container text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading your events...</p>
      </div>
    );

  if (error)
    return (
      <div className="container text-center py-5">
        <div className="alert alert-danger">{error}</div>
      </div>
    );

  if (sessions.length === 0)
    return (
      <div className="container text-center py-5">
        <div className="alert alert-info">No sessions found for your profile.</div>
      </div>
    );

  return (
    <div className="container">
      <div className="page-header text-center">
        <img
          src="https://res.cloudinary.com/dl9d5br4j/image/upload/v1744776724/Dual_Banner_from_Aydin_s_Merchant_e1uvhl.png"
          alt="GE Festival Banner"
          className="banner-image"
        />

        <h2 className="text-center">Talent Retreat Event Confirmation</h2>

        <p className="subtitle">
          Hi {participantName}, please confirm the events that you will attend for the Talent Institute Retreat.
        </p>
      </div>

      {success && (
        <div className="alert alert-success text-center fade-in-out">
          ✅ Your responses have been successfully recorded!
        </div>
      )}

      <form onSubmit={handleSubmit} id="confirmationForm">
        {sessions.map((record) => (
          <div
            key={record.id}
            className={`session-card ${
              record.fields[fieldConfirmation] === 'Yes' ? 'confirmed' : ''
            } ${record.fields[fieldConfirmation] === 'No' ? 'declined' : ''}`}
          >
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start">
              <div className="session-details">
                <h4 className="session-title">{record.fields[fieldSessionName]}</h4>

                {/* Role without icon */}
                <p className="session-info">
                  <strong>Role:</strong> {record.fields[fieldRole] || 'Participant'}
                </p>

                <p className="session-info">
                  <strong>Description:</strong>{' '}
                  {record.fields['Event Description (from Retreat/Festival Sessions)'] || 'No description available'}
                </p>

                <p className="session-info">
                  <strong>Date & Time:</strong> {formatDate(record.fields['Session Date/Time (from Retreat/Festival Sessions)'])}
                </p>

                <p className="session-info">
                  <strong>Location:</strong>{' '}
                  {record.fields['Session Location (from Retreat/Festival Sessions)'] || 'TBD'}
                </p>

                <p className="session-info mb-0">
                  <strong>Event Contact:</strong>{' '}
                  {record.fields['Festival POC (from Retreat/Festival Sessions)'] || 'N/A'}
                </p>
              </div>

              <div className="session-action">
                <label htmlFor={`confirmation-${record.id}`} className="form-label">
                  Will you attend?
                </label>
                <select
                  id={`confirmation-${record.id}`}
                  defaultValue={record.fields[fieldConfirmation] || ''}
                  className="form-select"
                  disabled={record.fields['Locked']}
                  onChange={(e) => {
                    const card = e.target.closest('.session-card');
                    card.classList.remove('confirmed', 'declined');
                    if (e.target.value === 'Yes') card.classList.add('confirmed');
                    if (e.target.value === 'No') card.classList.add('declined');
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes, I'll attend</option>
                  <option value="No">No, I can't attend</option>
                </select>

                {record.fields['Locked'] && (
                  <p className="mt-2 text-secondary small" style={{ fontStyle: 'italic' }}>
                    This response is now locked. Please contact your relationship manager to make changes.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="text-center mt-5">
          <button type="submit" className="submit-button">
            Submit Responses
          </button>
        </div>
      </form>
    </div>
  );
}
