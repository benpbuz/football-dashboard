# Fantasy Football Dashboard

This is a dynamic, auto-updating dashboard for the "Glass Palace Football" league.

## How It Works

- **Hosting**: Hosted for free on GitHub Pages.
- **Data Sources**:
    - **Live Scores**: Embedded from [SofaScore](https://www.sofascore.com/).
    - **Player Projections**: Fetched from the [Sleeper API](https://docs.sleeper.com/).
- **Custom Logic**: The `script.js` file fetches baseline projections and then applies the unique scoring rules found in `knowledge2.json` to create custom-tailored fantasy point projections.

## Known Limitations & Assumptions

- **Point Per First Down (PPFD)**: This stat is not projected by public APIs. The script **estimates** first downs based on a formula (`receptions * 0.5` and `rush_att * 0.25`). This is a significant approximation.
- **Punt Return Yards**: This is also not a standard projection. The script makes a small, estimated assignment for likely returners.
- **Data Freshness**: Projections are fetched for the upcoming week from Sleeper. The dashboard will be most accurate closer to the start of the weekly games.

## How to Update

- **Scoring Rules**: To update scoring rules, simply edit the `knowledge2.json` file and re-upload it to the GitHub repository. The dashboard will automatically use the new rules on the next page load.
- **Styling**: All visual styles are in `style.css`.