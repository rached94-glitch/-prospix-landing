import jsPDF from 'jspdf'
import LeadCard from './LeadCard'

function downloadPDF(leads) {
  try {
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const date = new Date().toLocaleDateString('fr-FR')

    // Background
    doc.setFillColor(22, 22, 32)
    doc.rect(0, 0, 210, 297, 'F')

    // Title
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(240, 240, 248)
    doc.text('Leads favoris', 14, 20)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110, 115, 135)
    doc.text(`${leads.length} lead${leads.length > 1 ? 's' : ''} · exporté le ${date}`, 14, 27)

    doc.setDrawColor(50, 55, 70)
    doc.setLineWidth(0.3)
    doc.line(14, 32, 196, 32)

    let y = 41

    leads.forEach((lead, i) => {
      // Page break guard
      if (y > 265) {
        doc.addPage()
        doc.setFillColor(22, 22, 32)
        doc.rect(0, 0, 210, 297, 'F')
        y = 20
      }

      const score = lead.score?.total ?? 0
      const sc    = score > 80 ? [16, 185, 129] : score >= 60 ? [245, 158, 11] : [239, 68, 68]

      // Lead card background
      doc.setFillColor(30, 32, 44)
      doc.roundedRect(12, y - 4, 186, 30, 3, 3, 'F')

      // Score bubble
      doc.setFillColor(38, 40, 55)
      doc.roundedRect(175, y - 2, 20, 14, 2, 2, 'F')
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(sc[0], sc[1], sc[2])
      doc.text(String(score), 185, y + 6, { align: 'center' })
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 95, 110)
      doc.text('/100', 185, y + 10, { align: 'center' })

      // Lead name
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(240, 240, 248)
      doc.text(lead.name ?? `Lead ${i + 1}`, 17, y + 4, { maxWidth: 152 })

      // Address
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(110, 115, 135)
      if (lead.address) doc.text(lead.address, 17, y + 10, { maxWidth: 152 })

      // Phone + website
      const contact = [lead.phone, lead.website?.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ')
      if (contact) {
        doc.setFontSize(7.5)
        doc.setTextColor(0, 175, 200)
        doc.text(contact, 17, y + 16, { maxWidth: 152 })
      }

      // Rating
      const rating = lead.google?.rating
      if (rating) {
        doc.setFontSize(7.5)
        doc.setTextColor(200, 160, 50)
        doc.text(`★ ${rating}  (${lead.google?.totalReviews ?? 0} avis)`, 17, y + 22)
      }

      y += 36
    })

    // Footer
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 65, 80)
    doc.text(`Généré le ${date} · LeadGen Pro · ${leads.length} favoris`, 14, 290)

    doc.save(`favoris-leadgen-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (err) {
    console.error('[PDF Favoris]', err)
    alert('Erreur PDF : ' + err.message)
  }
}

function downloadCSV(leads) {
  const headers = ['Nom', 'Adresse', 'Score', 'Note', 'Avis', 'Site web', 'Téléphone', 'Distance']
  const rows = leads.map(l => [
    l.name ?? '',
    l.address ?? '',
    l.score?.total ?? 0,
    l.google?.rating ?? '',
    l.google?.totalReviews ?? '',
    l.website ?? '',
    l.phone ?? '',
    l.distance != null ? `${l.distance}km` : '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `favoris-leadgen-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SidebarFavorites({ leads = [], selectedLead, onSelectLead }) {
  const favorites = leads.filter(l => l.status === 'favorite')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Favoris
          </span>
          <span style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            ⭐ {favorites.length}
          </span>
        </div>

        {favorites.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => downloadCSV(favorites)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#10b981',
                fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.08)')}
            >
              ↓ CSV
            </button>
            <button
              onClick={() => downloadPDF(favorites)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#818cf8',
                fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
            >
              ↓ PDF
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {favorites.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 10, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              ⭐
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 200 }}>
              Marque des leads en favori pour les retrouver ici
            </span>
          </div>
        ) : (
          <div style={{ paddingBottom: 12 }}>
            {favorites.map((lead, index) => (
              <LeadCard
                key={lead._id ?? lead.id}
                lead={lead}
                index={index}
                isSelected={selectedLead?._id === lead._id || selectedLead?.id === lead.id}
                onClick={onSelectLead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
