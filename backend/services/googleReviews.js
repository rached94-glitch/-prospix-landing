const axios = require('axios');
const { createCache } = require('../cache/searchCache')

const BASE_URL = 'https://maps.googleapis.com/maps/api/place/';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const TTL_7D        = 7 * 24 * 60 * 60 * 1000
const reviewsCache  = createCache('reviews')  // 7 jours

async function getReviews(placeId) {
  const cacheKey = `reviews_${placeId}`
  const cached   = reviewsCache.get(cacheKey)
  if (cached) return cached

  try {
    console.log(`[API COST] Appel réel à Google API: Place Details (reviews) maps.googleapis.com — placeId=${placeId}`)
    const response = await axios.get(`${BASE_URL}details/json`, {
      params: {
        place_id: placeId,
        fields: 'reviews,rating,user_ratings_total',
        key: API_KEY,
      },
    });

    const reviews = response.data.result?.reviews;
    if (!reviews || reviews.length === 0) {
      reviewsCache.set(cacheKey, [], TTL_7D)
      return [];
    }

    const result = reviews.slice(0, 5).map((review) => ({
      author_name: review.author_name,
      rating: review.rating,
      text: review.text,
      relative_time_description: review.relative_time_description,
    }));
    reviewsCache.set(cacheKey, result, TTL_7D)
    return result;
  } catch (err) {
    console.error(`Error fetching reviews for place ${placeId}:`, err.message);
    return [];
  }
}

module.exports = { getReviews };
