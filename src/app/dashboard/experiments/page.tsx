import ExperimentsView from "./ExperimentsView";

export default function ExperimentsPage() {
  return (
    <>
      <div className="dash-header">
        <div>
          <h1>your <em>experiments.</em></h1>
          <p className="sub">~ everything bandit has drafted, shipped, killed, or paused.</p>
        </div>
      </div>
      <ExperimentsView />
    </>
  );
}
