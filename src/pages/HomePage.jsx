import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function HomePage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(false);
  const [participantName, setParticipantName] = useState('');

  const personId           = new URLSearchParams(window.location.search).get('id');
  const fieldSessionName   = 'Event Name';
  const fieldRole          = 'Role';
  const fieldConfirmation  = 'Session Confirmation';

  useEffect(() => {
    if (!personId) {
      setError('No person ID provided. Use ?id=recordId in the URL.');
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        let all = [], offset;
        do {
          const res = await axios.get(
            `https://api.airtable.com/v0/${import.meta.env.VITE_AIRTABLE_BASE_ID}/tblLYaj9vr91ryIH9`,
            {
              headers: { Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}` },
              params: {
                pageSize: 100,
                offset,
                sort: [{ field: 'Session Date (from Retreat/Festival Sessions)', direction: 'asc' }]
              },
            }
          );
          all = all.concat(res.data.records);
          offset = res.data.offset;
        } while (offset);

        setSessions(
          all.filter(r =>
            Array.isArray(r.fields['WCAA Assigned']) &&
            r.fields['WCAA Assigned'].includes(personId)
          )
        );
      } catch (err) {
        console.error(err);
        setError('Failed to load sessions.');
      }
    };

    const fetchParticipant = async () => {
      try {
        const res = await axios.get(
          `https://api.airtable.com/v0/${import.meta.env.VITE_AIRTABLE_BASE_ID}/People/${personId}`,
          { headers: { Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}` } }
        );
        setParticipantName(res.data.fields['Name'] || '');
      } catch {}
    };

    Promise.all([fetchSessions(), fetchParticipant()]).finally(() => setLoading(false));
  }, [personId]);

  const handleSubmit = async e => {
    e.preventDefault();

    // 1) gather only those confirmations where a choice was made
    const updates = sessions
      .map(s => {
        const val = document.getElementById(`confirmation-${s.id}`).value;
        return { id: s.id, fields: { [fieldConfirmation]: val } };
      })
      .filter(u => u.fields[fieldConfirmation] !== '');

    if (!updates.length) {
      return alert('Please make at least one selection before submitting.');
    }

    // 2) your Airtable endpoint + headers
    const url = `https://api.airtable.com/v0/${import.meta.env.VITE_AIRTABLE_BASE_ID}/tblLYaj9vr91ryIH9`;
    const config = {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      // 3) patch the confirmation fields
      await axios.patch(url, { records: updates }, config);

      // 4) now lock every displayed session
      const lockUpdates = sessions.map(s => ({
        id: s.id,
        fields: { Locked: true }
      }));
      await axios.patch(url, { records: lockUpdates }, config);

      // 5) UI feedback
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Error submitting responses. Please try again.');
    }
  };

  const formatDate = ds => {
    if (!ds) return 'TBD';
    return new Date(ds).toLocaleDateString('en-US', {
      timeZone: 'Asia/Dubai',
      dateStyle: 'full',
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
  if (!sessions.length)
    return (
      <div className="container text-center py-5">
        <div className="alert alert-info">No sessions found for your profile.</div>
      </div>
    );

  return (
    <div>
      <div className="container">
        {/* Banner */}
        <img
          src="https://res.cloudinary.com/dl9d5br4j/image/upload/v1745126797/TI_Letterhead_4x6_1_hzopb5.png"
          alt="GE Festival Banner"
          className="banner-image banner-full"
        />

        <div className="page-header text-center">
          <h2 className="confirmation-header">TI Retreat and GE Festival Confirmation</h2>
          <div className="schedule-header">
            <p className="schedule-title">Schedule for {participantName}</p>
            <p className="schedule-subtitle">
            Please confirm your attendance for the events listed below. We are working to finalize additional events to engage our World Class Artists and Athletes at the Festival. As these events are finalized, we will reach out for secondary confirmation.
            </p>
          </div>
        </div>

        {success && (
          <div className="alert alert-success text-center fade-in-out">
            ✅ Your responses have been successfully recorded!
          </div>
        )}

        <div className="sessions-section">
          <img
            src="https://res.cloudinary.com/dl9d5br4j/image/upload/v1745118459/Purple_Icon_ztkf9d.png"
            alt="diamond"
            className="sessions-diamond"
          />

          <form onSubmit={handleSubmit} id="confirmationForm">
            {sessions.map(rec => (
              <div
                key={rec.id}
                className={`session-card ${
                  rec.fields[fieldConfirmation] === 'Yes' ? 'confirmed' : ''
                } ${rec.fields[fieldConfirmation] === 'No' ? 'declined' : ''}`}
              >
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start">
                  <div className="session-details">
                    <h4 className="session-title">{rec.fields[fieldSessionName]}</h4>
                    <p className="session-info">
                      <strong>Role:</strong> {rec.fields[fieldRole] || 'Participant'}
                    </p>
                    <p className="session-info">
                      <strong>Description:</strong>{' '}
                      {rec.fields['Event Description (from Retreat/Festival Sessions)'] ||
                        'No description available'}
                    </p>
                    <p className="session-info">
                      <strong>Date:</strong>{' '}
                      {formatDate(rec.fields['Session Date (from Retreat/Festival Sessions)'])}
                    </p>
                    <p className="session-info">
                      <strong>Location:</strong>{' '}
                      {rec.fields['Session Location (from Retreat/Festival Sessions)'] || 'TBD'}
                    </p>
                  </div>

                  <div className="session-action">
                    <label htmlFor={`confirmation-${rec.id}`} className="form-label">
                      Will you attend?
                    </label>
                    <select
                      id={`confirmation-${rec.id}`}
                      defaultValue={rec.fields[fieldConfirmation] || ''}
                      className="form-select"
                      disabled={rec.fields['Locked']}
                      onChange={e => {
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
                    {rec.fields['Locked'] && (
                      <p
                        className="mt-2 text-secondary small"
                        style={{ fontStyle: 'italic' }}
                      >
                        This response is now locked. Please contact your relationship manager to
                        make changes.
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

          {/* footer note */}
          <p className="footer-note text-center">
            If you require any further details, please email{' '}
            <a href="mailto:talentinstitute@globalencounters.ismaili">
              talentinstitute@globalencounters.ismaili
            </a>{' '}
            — we will respond within 48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
