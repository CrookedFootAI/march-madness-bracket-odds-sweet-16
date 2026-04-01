import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const store = getStore({
      name: "march-madness",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    const data = await store.get("live-odds", { type: "json" });

    if (!data) {
      return Response.json({ error: "No odds data yet" }, { status: 404 });
    }

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300", // cache 5 min in browser
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("get-odds error:", err);
    return Response.json({ error: "Failed to load odds" }, { status: 500 });
  }
};

export const config = { path: "/api/odds" };
