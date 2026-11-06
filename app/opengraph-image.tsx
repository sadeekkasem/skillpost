import { ImageResponse } from "next/og";

export const alt = "SkillPost — Show your skills through your work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4faf6",
        color: "#123b2a",
        border: "24px solid #0e7a45",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 98, fontWeight: 700 }}>
        <span>Skill</span>
        <span style={{ color: "#0e7a45" }}>Post</span>
      </div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 44 }}>
        Show your skills through your work
      </div>
      <div style={{ display: "flex", marginTop: 26, color: "#426456", fontSize: 28 }}>
        skillpostapp.com
      </div>
    </div>,
    size
  );
}
