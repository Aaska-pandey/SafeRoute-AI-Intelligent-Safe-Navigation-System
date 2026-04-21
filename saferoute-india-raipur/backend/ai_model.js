// Simple AI scoring system (simulating ML models)

function logisticScore(features) {
    const {
        harassment,
        dark,
        robbery,
        other,
        distance
    } = features;

    // simple weighted formula
    return (
        0.3 * harassment +
        0.25 * dark +
        0.3 * robbery +
        0.1 * other +
        0.05 * distance
    );
}

function randomForestScore(features) {
    const {
        harassment,
        dark,
        robbery,
        other,
        distance
    } = features;

    // slightly different logic
    return (
        0.4 * harassment +
        0.3 * robbery +
        0.2 * dark +
        0.1 * distance
    );
}



function getFinalScore(features) {
    const logScore = logisticScore(features);
    const rfScore = randomForestScore(features);

    // Ensemble
    const finalScore = (0.4 * logScore) + (0.6 * rfScore);

    return {
        logScore,
        rfScore,
        finalScore
    };
}

module.exports = { getFinalScore };