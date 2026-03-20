import { Link } from "react-router";
import { OraLogo } from "./OraLogo";

export function Footer() {
  const links = [
    { label: "Models", href: "/models" },
    { label: "Pricing", href: "/pricing" },
    { label: "Hub", href: "/hub" },
    { label: "Privacy", href: "#" },
  ];

  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#131211" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <OraLogo size={24} animate={false} color="#5C5856" />
            <div className="flex items-center gap-5">
              {links.map((l) => (
                <Link
                  key={l.label}
                  to={l.href}
                  className="transition-colors hover:text-foreground"
                  style={{ fontSize: "13px", color: "#5C5856", fontWeight: 400 }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "#5C5856" }}>
            2026 ORA
          </p>
        </div>
      </div>
    </footer>
  );
}
