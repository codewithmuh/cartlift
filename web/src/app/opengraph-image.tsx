/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bandit — Convert more visitors. Open-source CRO platform.";
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

        {/* lime glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(74,222,128,0.18) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "2.5px solid #4ade80",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#4ade80",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            B
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
            bandit
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
          <span style={{ display: "flex" }}>Convert more visitors.</span>
          <span style={{ display: "flex", color: "#4ade80" }}>
            <span style={{ color: "#555", marginRight: 16 }}>›</span> Open-source.
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
            <span>compliance</span>
            <span style={{ color: "#333" }}>·</span>
            <span>gmc</span>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 16,
              color: "#4ade80",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            ● github.com/codewithmuh/bandit
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
