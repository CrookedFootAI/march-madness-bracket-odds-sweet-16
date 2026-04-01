import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const store = getStore({
      name: "march-madness",
      siteID: "bf3f99a9-6c22-42cc-9755-bcfe773c01df",
      token: process.env.BLOBS_TOKEN,
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
