document.addEventListener('DOMContentLoaded', () => {
    // Global state
    let allPlayers = [];
    let leagueScoringRules = {};

    // --- 1. INITIALIZATION ---
    async function initializeDashboard() {
        try {
            leagueScoringRules = await fetchLeagueSettings();
            
            // Fetch Sleeper's general player data (for names, teams, positions)
            const allNflPlayers = await fetchSleeperPlayerData();
            
            // Fetch Sleeper's weekly projections
            const projections = await fetchSleeperProjections();
            
            // Combine data and calculate custom projections
            allPlayers = processPlayerData(allNflPlayers, projections);
            
            // Render dashboard components
            renderProjectionsTable(allPlayers);
            populateTradeAnalyzer(allPlayers);

        } catch (error) {
            console.error("Dashboard initialization failed:", error);
            document.getElementById('projections-body').innerHTML = `<tr><td colspan="4">Error loading data. Check console for details.</td></tr>`;
        }
    }

    // --- 2. DATA FETCHING ---
    async function fetchLeagueSettings() {
        const response = await fetch('knowledge2.json');
        if (!response.ok) throw new Error("Failed to load knowledge2.json");
        return await response.json();
    }
    
    async function fetchSleeperPlayerData() {
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) throw new Error("Failed to fetch Sleeper player data");
        return await response.json();
    }

    async function fetchSleeperProjections() {
        // NOTE: Using 2024 data as 2025 is not yet available.
        // CHANGE THIS BACK TO 2025 WHEN THE SEASON STARTS.
        const response = await fetch('https://api.sleeper.app/v1/projections/nfl/regular/2024/1');
        if (!response.ok) throw new Error("Failed to fetch Sleeper projections");
        return await response.json();
    }
    
    // --- 3. DATA PROCESSING & PROJECTION CALCULATION ---
    function processPlayerData(playerData, projections) {
        const relevantPlayers = projections.map(proj => {
            const playerInfo = playerData[proj.player_id];
            if (!playerInfo || !['QB', 'RB', 'WR', 'TE'].includes(playerInfo.position)) {
                return null;
            }
            
            const customProjection = calculateCustomProjection(proj.stats, playerInfo);
            
            return {
                id: proj.player_id,
                name: playerInfo.full_name || `${playerInfo.first_name} ${playerInfo.last_name}`,
                pos: playerInfo.position,
                team: playerInfo.team || 'FA',
                projection: parseFloat(customProjection.toFixed(2))
            };
        }).filter(p => p && p.projection > 0 && p.name); // Filter out nulls, zero-projection, and nameless players
        
        // Sort by projection descending by default
        return relevantPlayers.sort((a, b) => b.projection - a.projection);
    }
    
    function calculateCustomProjection(stats, playerInfo) {
        const rules = leagueScoringRules.scoringRules;
        let totalPoints = 0;

        // Helper to find a rule's value
        const getRule = (type, statName) => rules[type]?.find(r => r.stat === statName)?.points || 0;

        // Passing
        totalPoints += (stats.pass_yd || 0) * getRule('passing', 'Passing Yards');
        totalPoints += (stats.pass_td || 0) * getRule('passing', 'TD Pass');
        totalPoints += (stats.pass_int || 0) * getRule('passing', 'Interception Thrown');
        
        // Rushing
        totalPoints += (stats.rush_yd || 0) * getRule('rushing', 'Rushing Yards');
        totalPoints += (stats.rush_td || 0) * getRule('rushing', 'TD Rush');

        // Receiving
        totalPoints += (stats.rec_yd || 0) * getRule('receiving', 'Receiving Yards');
        totalPoints += (stats.rec || 0) * getRule('receiving', 'Reception');
        totalPoints += (stats.rec_td || 0) * getRule('receiving', 'TD Reception');

        // *** CUSTOM RULE ESTIMATIONS ***
        // 1. Point Per First Down (PPFD) - This is a MAJOR estimation
        const rushFD = (stats.rush_att || 0) * 0.25; // Estimate 1 FD per 4 attempts
        const recFD = (stats.rec || 0) * 0.5; // Estimate 1 FD per 2 receptions
        totalPoints += (rushFD * getRule('rushing', 'Rushing First Down'));
        totalPoints += (recFD * getRule('receiving', 'Receiving First Down'));
        // NOTE: Passing First Down is too complex to estimate reliably from available stats.

        // 2. Punt Return Yards - Another estimation
        if (playerInfo.depth_chart_order === 1 && (playerInfo.position === 'WR' || playerInfo.position === 'RB')) {
             // Assume primary skill players who are returners might get yards
             const puntReturnYards = (stats.games_played || 1) * 15; // Estimate 15 PR yards/game
             totalPoints += puntReturnYards * getRule('individualPlayer', 'Punt Return Yards');
        }

        return totalPoints;
    }

    // --- 4. RENDER DASHBOARD COMPONENTS ---
    function renderProjectionsTable(playersToRender) {
        const tbody = document.getElementById('projections-body');
        tbody.innerHTML = ''; // Clear existing rows
        if (playersToRender.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No players match your search.</td></tr>';
            return;
        }

        playersToRender.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${player.name}</td>
                <td>${player.pos}</td>
                <td>${player.team}</td>
                <td>${player.projection}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    function populateTradeAnalyzer(players) {
        const dropdowns = document.querySelectorAll('.player-dropdown');
        dropdowns.forEach(dropdown => {
            // Clear existing options before populating
            dropdown.innerHTML = '<option>Select Player</option>';
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                option.textContent = `${player.name} (${player.pos}) - ${player.projection}`;
                option.dataset.projection = player.projection;
                option.dataset.name = player.name;
                dropdown.appendChild(option);
            });
        });
    }

    // --- 5. EVENT LISTENERS ---
    // Projection Table Search
    document.getElementById('projection-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPlayers = allPlayers.filter(p => p.name.toLowerCase().includes(searchTerm));
        renderProjectionsTable(filteredPlayers);
    });

    // Trade Analyzer Logic
    document.querySelector('.trade-interface').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-player')) {
            const side = e.target.dataset.side;
            const dropdown = e.target.closest('.player-selection').querySelector('.player-dropdown');
            const selectedOption = dropdown.options[dropdown.selectedIndex];
            
            if (!selectedOption.value || selectedOption.value === 'Select Player') return;

            const playerId = selectedOption.value;
            const playerName = selectedOption.dataset.name;
            const playerProj = parseFloat(selectedOption.dataset.projection);

            const list = document.getElementById(`list${side}`);
            const listItem = document.createElement('li');
            listItem.dataset.id = playerId;
            listItem.dataset.proj = playerProj;
            listItem.innerHTML = `<span>${playerName} (${playerProj})</span><span class="remove-player">✖</span>`;
            list.appendChild(listItem);

            updateTradeTotals();
        }

        if (e.target.classList.contains('remove-player')) {
            e.target.parentElement.remove();
            updateTradeTotals();
        }
    });

    function updateTradeTotals() {
        const totalA = Array.from(document.querySelectorAll('#listA li')).reduce((sum, li) => sum + parseFloat(li.dataset.proj), 0);
        const totalB = Array.from(document.querySelectorAll('#listB li')).reduce((sum, li) => sum + parseFloat(li.dataset.proj), 0);

        document.getElementById('totalA').textContent = `Total Value: ${totalA.toFixed(2)}`;
        document.getElementById('totalB').textContent = `Total Value: ${totalB.toFixed(2)}`;
        
        const resultDiv = document.getElementById('trade-result');
        const diff = Math.abs(totalA - totalB);
        if (totalA === 0 && totalB === 0) {
            resultDiv.textContent = '';
            return;
        }

        if (totalA > totalB) {
            resultDiv.textContent = `Side A wins by ${diff.toFixed(2)} points.`;
            resultDiv.style.color = '#48bb78'; // Green
        } else if (totalB > totalA) {
            resultDiv.textContent = `Side B wins by ${diff.toFixed(2)} points.`;
            resultDiv.style.color = '#48bb78'; // Green
        } else {
            resultDiv.textContent = 'The trade is projected to be even.';
            resultDiv.style.color = 'var(--font-color)';
        }
    }

    // Kick things off
    initializeDashboard();
});