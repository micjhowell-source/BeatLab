export function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot  += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function aggregateSimilarity(attemptVector, referenceVectors) {
  const scores = referenceVectors
    .map(ref => cosineSimilarity(attemptVector, ref))
    .sort((a, b) => b - a);
  const topN = Math.max(1, Math.ceil(scores.length * 0.6));
  const mean = scores.slice(0, topN).reduce((a, b) => a + b, 0) / topN;
  return Math.round(mean * 100);
}
