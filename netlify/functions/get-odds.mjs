const TEAM_MAP = {
  "Duke Blue Devils": "Duke",
  "Connecticut Huskies": "UCONN",
  "UConn Huskies": "UCONN",
  "Michigan State Spartans": "Michigan St.",
  "St. John's Red Storm": "St. John's",
  "Arizona Wildcats": "Arizona",
  "Purdue Boilermakers": "Purdue",
  "Arkansas Razorbacks": "Arkansas",
  "Texas Longhorns": "Texas",
  "Houston Cougars": "Houston",
  "Illinois Fighting Illini": "Illinois",
  "Nebraska Cornhuskers": "Nebraska",
  "Iowa Hawkeyes": "Iowa",
  "Michigan Wolverines": "Michigan",
  "Iowa State Cyclones": "Iowa State",
  "Alabama Crimson Tide": "Alabama",
  "Tennessee Volunteers": "Tennessee",
};

function normalize(name) {
  return TEAM_MAP[name] || null;
}

function getConsensusOdds(bookmakers, market) {
  const allOutcomes = {};
  let count = 0;
  for (const bm of bookmakers) {
    const mkt = bm.markets?.find((m) => m.key === market);
    if (!mkt) continue;
    count++;
    for (const outcome of mkt.outcomes) {
      const key = outcome.name;
      if (!allOutcomes[key]) allOutcomes[key] = { priceSum: 0, pointSum: 0, n: 0 };
      allOutcomes[key].priceSum += outcome.price;
      if (outcome.point !== undefined) allOutcomes[key].pointSum += outcome.point;
      allOutcomes[key].n++;
    }
  }
  if (count === 0) return null;
  const result = {};
  for (const [name, val] of Object.entries(allOutcomes)) {
    result[name] = {
      price: Math.round(val.priceSum / val.n),
      point: val.n > 0 ? Math.round((val.pointSum / val.n) * 2) / 2 : undefined,
    };
  }
  return result;
}

export default async (req, context) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "ODDS_API_KEY not set" }, { status: 500 });
    }

    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
    );

    if (!res.ok) {
      console.error("Odds API error:", res.status);
      return Response.json({ error: "Odds API error" }, { status: 502 });
    }

    const games = await res.json();
    const oddsLookup = {};

    for (const game of games) {
      const home = normalize(game.home_team);
      const away = normalize(game.away_team);
      if (!home || !away) continue;

      const h2h = getConsensusOdds(game.bookmakers, "h2h");
      const spreads = getConsensusOdds(game.bookmakers, "spreads");
      const totals = getConsensusOdds(game.bookmakers, "totals");
      if (!h2h) continue;

      const homeML = h2h[game.home_team]?.price ?? 0;
      const awayML = h2h[game.away_team]?.price ?? 0;
      const favName = homeML <= awayML ? home : away;
      const dogName = homeML <= awayML ? away : home;
      const favML = homeML <= awayML ? homeML : awayML;
      const dogML = homeML <= awayML ? awayML : homeML;

      const favSpread = spreads
        ? (spreads[game.home_team]?.point ?? spreads[game.away_team]?.point ?? null)
        : null;
      const spreadVal = favName === home ? favSpread : favSpread !== null ? -favSpread : null;
      const overTotal = totals ? (totals["Over"]?.point ?? null) : null;

      const entry = {
        fav: favName,
        dog: dogName,
        ml: favML,
        dogML: dogML,
        spread: spreadVal,
        ou: overTotal,
        gameTime: game.commence_time,
      };

      oddsLookup[`${favName} vs ${dogName}`] = entry;
      oddsLookup[`${dogName} vs ${favName}`] = entry;
    }

    console.log(`✅ Returning odds for ${Object.keys(oddsLookup).length / 2} games | Requests remaining: ${res.headers.get('x-requests-remaining')} | Used: ${res.headers.get('x-requests-used')}`);

    return Response.json(
      {
        updatedAt: new Date().toISOString(),
        odds: oddsLookup,
        quota: {
          remaining: res.headers.get('x-requests-remaining'),
          used: res.headers.get('x-requests-used'),
        }
      },
      {
        headers: {
          "Cache-Control": "public, max-age=7200",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("get-odds error:", err);
    return Response.json({ error: "Failed to load odds" }, { status: 500 });
  }
};

export const config = { path: "/api/odds" };
