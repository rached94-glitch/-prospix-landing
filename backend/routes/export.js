const express = require('express');
const router = express.Router();

function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(leads) {
  const headers = [
    'Nom', 'Adresse', 'Téléphone', 'Site Web',
    'Note Google', 'Nombre Avis',
    'Score Total', 'Score Rating', 'Score Avis', 'Score Digital', 'Score Opportunité',
    'LinkedIn', 'Facebook', 'Instagram', 'TikTok',
    'Latitude', 'Longitude', 'Distance km', 'Domaine', 'Statut',
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.address,
    lead.phone,
    lead.website,
    lead.google?.rating,
    lead.google?.totalReviews,
    lead.score?.total,
    lead.score?.breakdown?.googleRating,
    lead.score?.breakdown?.reviewVolume,
    lead.score?.breakdown?.digitalPresence,
    lead.score?.breakdown?.opportunity,
    lead.social?.linkedin,
    lead.social?.facebook,
    lead.social?.instagram,
    lead.social?.tiktok,
    lead.lat,
    lead.lng,
    lead.distance,
    lead.domain,
    lead.status,
  ].map(escapeCSV).join(','));

  return [headers.join(','), ...rows].join('\n');
}

router.post('/csv', (req, res) => {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads array is required and must not be empty' });
    }

    const csv = buildCSV(leads);
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${date}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Error in POST /api/export/csv:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
