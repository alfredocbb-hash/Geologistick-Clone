/**
 * Uses Google Maps Directions API to generate a street-level path
 * from a series of GPS points, splitting into chunks of ≤23 waypoints.
 */

const MAX_WAYPOINTS_PER_REQUEST = 23;

export async function fetchDirectionsPath(
  points: { lat: number; lng: number }[]
): Promise<{ lat: number; lng: number }[]> {
  if (!window.google?.maps || points.length < 2) return [];

  const directionsService = new google.maps.DirectionsService();

  // Sample points if there are too many (Directions API is expensive per call)
  const sampled = samplePoints(points, 100);
  if (sampled.length < 2) return [];

  const fullPath: { lat: number; lng: number }[] = [];

  // Split into chunks: each chunk has origin + destination + up to MAX_WAYPOINTS waypoints
  for (let i = 0; i < sampled.length - 1; i += MAX_WAYPOINTS_PER_REQUEST + 1) {
    const chunkStart = sampled[i];
    const endIndex = Math.min(i + MAX_WAYPOINTS_PER_REQUEST + 1, sampled.length - 1);
    const chunkEnd = sampled[endIndex];
    const waypointSlice = sampled.slice(i + 1, endIndex);

    const waypoints = waypointSlice.map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      stopover: false,
    }));

    try {
      const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
        directionsService.route(
          {
            origin: new google.maps.LatLng(chunkStart.lat, chunkStart.lng),
            destination: new google.maps.LatLng(chunkEnd.lat, chunkEnd.lng),
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
          },
          (res, status) => {
            resolve(status === google.maps.DirectionsStatus.OK ? res : null);
          }
        );
      });

      if (result?.routes?.[0]?.overview_path) {
        const pathPoints = result.routes[0].overview_path.map(p => ({
          lat: p.lat(),
          lng: p.lng(),
        }));
        // Remove first point of subsequent chunks to avoid duplicates
        if (fullPath.length > 0) pathPoints.shift();
        fullPath.push(...pathPoints);
      }
    } catch (err) {
      console.error('Directions API chunk error:', err);
    }
  }

  return fullPath;
}

/**
 * Evenly sample N points from a larger array, always keeping first and last.
 */
function samplePoints(
  points: { lat: number; lng: number }[],
  maxPoints: number
): { lat: number; lng: number }[] {
  if (points.length <= maxPoints) return points;

  const result: { lat: number; lng: number }[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(points[Math.round(i * step)]);
  }

  result.push(points[points.length - 1]);
  return result;
}
