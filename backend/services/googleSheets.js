const { google } = require('googleapis')

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const SCOPES   = ['https://www.googleapis.com/auth/spreadsheets']

const HEADERS = [
  'Nom', 'Adresse', 'Téléphone', 'Site Web',
  'Note Google', 'Nombre Avis', 'Score Total',
  'LinkedIn', 'Facebook', 'Instagram', 'TikTok',
  'Distance km', 'Domaine', 'Source', 'Date ajout',
  'Décideur Nom', 'Décideur Titre', 'Décideur LinkedIn',
]

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY requis dans .env')
  }

  return new google.auth.JWT({ email, key, scopes: SCOPES })
}

async function ensureHeaders(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:R1',
  })
  const firstRow = res.data.values?.[0] ?? []
  if (firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [HEADERS] },
    })
  }
}

async function appendLead(lead) {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID non configuré dans .env')

  const auth   = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  await ensureHeaders(sheets)

  const row = [
    lead.name         || '',
    lead.address      || '',
    lead.phone        || '',
    lead.website      || '',
    lead.google?.rating       ?? '',
    lead.google?.totalReviews ?? '',
    lead.score?.total         ?? '',
    lead.social?.linkedin     || '',
    lead.social?.facebook     || '',
    lead.social?.instagram    || '',
    lead.social?.tiktok       || '',
    lead.distance != null ? String(lead.distance) : '',
    lead.domain       || '',
    'Favori',
    new Date().toLocaleDateString('fr-FR'),
    lead.decisionMaker?.name     || '',
    lead.decisionMaker?.title    || '',
    lead.decisionMaker?.linkedin || '',
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:R',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] },
  })
}

module.exports = { appendLead }
