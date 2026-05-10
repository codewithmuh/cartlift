import SitesView from "./SitesView";

export default function SitesPage() {
  return (
    <>
      <div className="dash-header">
        <div>
          <h1>your <em>sites.</em></h1>
          <p className="sub">~ register a domain. install the snippet. bandit takes it from there.</p>
        </div>
      </div>
      <SitesView />
    </>
  );
}
