
export const fetchPexelsImages = async (query, perPage = 5) => {
  if (!query) return [];
  
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.warn("PEXELS_API_KEY not configured");
      return [];
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
      {
        headers: { Authorization: apiKey },
      }
    );

    if (!response.ok) {
        // Log silently
        console.error(`Pexels API Error: ${response.statusText}`);
        return [];
    }

    const data = await response.json();
    return data.photos.map(photo => ({
      url: photo.src.medium, // Optimized for mobile/web
      alt: photo.alt,
      photographer: photo.photographer
    }));
  } catch (error) {
    console.error("Pexels Fetch Error:", error.message);
    return [];
  }
};
