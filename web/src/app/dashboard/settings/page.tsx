import SettingsView from "./SettingsView";

export default function SettingsPage() {
  return (
    <>
      <div className="dash-header">
        <div>
          <h1>your <em>account.</em></h1>
          <p className="sub">~ company name shows up on lookbook exports and reports</p>
        </div>
      </div>
      <SettingsView />
    </>
  );
}
