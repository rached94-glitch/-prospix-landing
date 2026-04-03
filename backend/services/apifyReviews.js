const { ApifyClient } = require('apify-client')

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
})

async function getAllReviews(placeId) {
  try {
    const run = await client.actor('compass/google-maps-reviews-scraper').call({
      placeIds: [`ChIJ${placeId}`],
      maxReviews: 100,
      reviewsSort: 'newest',
      language: 'fr',
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    return items.map(r => ({
      author:     r.name,
      rating:     r.stars,
      text:       r.text,
      date:       r.publishedAtDate,
      ownerReply: r.responseFromOwnerText || null,
      likes:      r.likesCount || 0,
    }))
  } catch (e) {
    console.error('Apify error:', e.message)
    return []
  }
}

module.exports = { getAllReviews }
