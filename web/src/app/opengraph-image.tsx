/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cartlift — Lift every cart. Open-source ecommerce CRO platform.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function og() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0c0c0c",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#ededed",
          position: "relative",
        }}
      >
        {/* dot grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.04) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* coral glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(251,146,60,0.22) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "2.5px solid #fb923c",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#fb923c",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            C
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            cartlift
          </div>
        </div>

        {/* spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* headline */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            color: "#ededed",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ display: "flex" }}>Lift every cart.</span>
          <span style={{ display: "flex", color: "#fb923c" }}>
            <span style={{ color: "#555", marginRight: 16 }}>›</span> Grow your store.
          </span>
        </div>

        {/* sub + tag row */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              fontFamily: "ui-monospace, monospace",
              fontSize: 18,
              color: "#888",
            }}
          >
            <span>cro</span>
            <span style={{ color: "#333" }}>·</span>
            <span>seo</span>
            <span style={{ color: "#333" }}>·</span>
            <span>trust</span>
            <span style={{ color: "#333" }}>·</span>
            <span>shopping feed</span>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 16,
              color: "#fb923c",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            ● github.com/codewithmuh/cartlift
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
