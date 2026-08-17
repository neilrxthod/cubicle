import { ImageResponse } from "next/og";

export const alt = "Cubicle — laptop cart scheduling for school staff";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            fontWeight: 500,
            color: "rgba(250,250,250,0.72)",
          }}
        >
          Cubicle
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              lineHeight: 1.05,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              maxWidth: 920,
            }}
          >
            Laptop cart scheduling for school staff.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "rgba(250,250,250,0.55)",
              letterSpacing: "-0.02em",
            }}
          >
            Allowlisted school Google accounts only · mycubicle.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
