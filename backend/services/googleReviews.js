const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place/';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function getReviews(placeId) {
  try {
    const response = await axios.get(`${BASE_URL}details/json`, {
      params: {
        place_id: placeId,
        fields: 'reviews,rating,user_ratings_total',
        key: API_KEY,
      },
    });

    const reviews = response.data.result?.reviews;
    if (!reviews || reviews.length === 0) return [];

    return reviews.slice(0, 5).map((review) => ({
      author_name: review.author_name,
      rating: review.rating,
      text: review.text,
      relative_time_description: review.relative_time_description,
    }));
  } catch (err) {
    console.error(`Error fetching reviews for place ${placeId}:`, err.message);
    return [];
  }
}

module.exports = { getReviews };
