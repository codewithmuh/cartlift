import type { Metadata } from "next";
import Sidebar from "./Sidebar";
import AuditBar from "./AuditBar";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-shell">
      <Sidebar />
      <main className="dash-main">
        <AuditBar />
        <div className="dash-content">{children}</div>
      </main>
    </div>
  );
}
