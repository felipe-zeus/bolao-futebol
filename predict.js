const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const resultsPath = path.join(__dirname, 'archive', 'results.csv');
const outputPath = path.join(__dirname, 'public', 'prediction.json');

// Simplified Elo rating system or Power Score
const teams = {};

function getTeam(name) {
    if (!teams[name]) {
        teams[name] = { name, matches: 0, points: 0, goalsFor: 0, goalsAgainst: 0, power: 1000 };
    }
    return teams[name];
}

function updatePower(home, away, homeScore, awayScore) {
    const k = 20;
    const expectedHome = 1 / (1 + Math.pow(10, (away.power - home.power) / 400));
    const expectedAway = 1 / (1 + Math.pow(10, (home.power - away.power) / 400));

    let homeActual = 0.5;
    let awayActual = 0.5;
    if (homeScore > awayScore) {
        homeActual = 1;
        awayActual = 0;
    } else if (homeScore < awayScore) {
        homeActual = 0;
        awayActual = 1;
    }

    home.power += k * (homeActual - expectedHome);
    away.power += k * (awayActual - expectedAway);
}

const parseData = () => {
    return new Promise((resolve, reject) => {
        fs.createReadStream(resultsPath)
            .pipe(csv())
            .on('data', (row) => {
                const date = new Date(row.date);
                if (date.getFullYear() >= 2018) { // Focus on recent form
                    const homeScore = parseInt(row.home_score);
                    const awayScore = parseInt(row.away_score);
                    
                    if (!isNaN(homeScore) && !isNaN(awayScore)) {
                        const home = getTeam(row.home_team);
                        const away = getTeam(row.away_team);
                        
                        home.matches++;
                        away.matches++;
                        home.goalsFor += homeScore;
                        home.goalsAgainst += awayScore;
                        away.goalsFor += awayScore;
                        away.goalsAgainst += homeScore;
                        
                        updatePower(home, away, homeScore, awayScore);
                    }
                }
            })
            .on('end', () => {
                resolve();
            })
            .on('error', reject);
    });
};

function simulateMatch(teamA, teamB) {
    const probA = 1 / (1 + Math.pow(10, (teamB.power - teamA.power) / 400));
    const rand = Math.random();
    if (rand < probA) return teamA;
    return teamB;
}

async function main() {
    await parseData();

    // Select top 32 teams for the tournament based on power
    const sortedTeams = Object.values(teams)
        .filter(t => t.matches >= 10)
        .sort((a, b) => b.power - a.power)
        .slice(0, 32);

    // Create 8 groups of 4
    const groups = [];
    for (let i = 0; i < 8; i++) {
        groups.push({
            name: `Group ${String.fromCharCode(65 + i)}`,
            teams: [
                sortedTeams[i],
                sortedTeams[i + 8],
                sortedTeams[i + 16],
                sortedTeams[i + 24]
            ].sort(() => 0.5 - Math.random()) // shuffle within group loosely
        });
    }

    const prediction = {
        tournament: "2026 World Cup Simulation",
        groups: [],
        knockout: {
            roundOf16: [],
            quarterFinals: [],
            semiFinals: [],
            final: [],
            champion: null
        }
    };

    // Simulate Groups
    const groupWinners = [];
    const groupRunnersUp = [];

    groups.forEach(group => {
        let standings = group.teams.map(t => ({ name: t.name, power: t.power, pts: 0 }));
        for (let i = 0; i < standings.length; i++) {
            for (let j = i + 1; j < standings.length; j++) {
                const winner = simulateMatch(standings[i], standings[j]);
                if (winner.name === standings[i].name) standings[i].pts += 3;
                else standings[j].pts += 3;
            }
        }
        standings.sort((a, b) => b.pts - a.pts || b.power - a.power);
        prediction.groups.push({
            name: group.name,
            standings: standings.map(s => s.name)
        });
        groupWinners.push(standings[0]);
        groupRunnersUp.push(standings[1]);
    });

    // Knockout Stage: Round of 16
    const r16 = [];
    for (let i = 0; i < 8; i++) {
        r16.push(simulateMatch(groupWinners[i], groupRunnersUp[7 - i]));
        prediction.knockout.roundOf16.push(`${groupWinners[i].name} vs ${groupRunnersUp[7 - i].name}`);
    }

    // Quarter Finals
    const qf = [];
    for (let i = 0; i < 4; i++) {
        qf.push(simulateMatch(r16[i * 2], r16[i * 2 + 1]));
        prediction.knockout.quarterFinals.push(`${r16[i * 2].name} vs ${r16[i * 2 + 1].name}`);
    }

    // Semi Finals
    const sf = [];
    for (let i = 0; i < 2; i++) {
        sf.push(simulateMatch(qf[i * 2], qf[i * 2 + 1]));
        prediction.knockout.semiFinals.push(`${qf[i * 2].name} vs ${qf[i * 2 + 1].name}`);
    }

    // Final
    const champion = simulateMatch(sf[0], sf[1]);
    prediction.knockout.final.push(`${sf[0].name} vs ${sf[1].name}`);
    prediction.knockout.champion = champion.name;

    if (!fs.existsSync(path.join(__dirname, 'public'))) {
        fs.mkdirSync(path.join(__dirname, 'public'));
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(prediction, null, 2));
    console.log("Prediction generated at", outputPath);
}

main().catch(console.error);
