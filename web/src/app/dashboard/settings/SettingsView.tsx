"use client";

import { useEffect, useState } from "react";
import { ApiError, api, auth, type LlmProvider, type Me } from "@/lib/api";

const MODELS: Record<LlmProvider, { value: string; label: string; hint?: string }[]> = {
  anthropic: [
    { value: "", label: "default (claude-sonnet-4-6)" },
    { value: "claude-opus-4-7", label: "claude-opus-4-7", hint: "best quality" },
    { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6", hint: "balanced" },
    { value: "claude-haiku-4-5", label: "claude-haiku-4-5", hint: "fastest + cheapest" },
  ],
  openai: [
    { value: "", label: "default (gpt-4o)" },
    { value: "gpt-5", label: "gpt-5", hint: "best quality" },
    { value: "gpt-5-mini", label: "gpt-5-mini", hint: "balanced" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini", hint: "fastest + cheapest" },
  ],
};

export default function SettingsView() {
  const [me, setMe] = useState<Me | null>(null);
  const [company, setCompany] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // LLM panel state — provider, model, both key drafts.
  const [provider, setProvider] = useState<LlmProvider>("anthropic");
  const [model, setModel] = useState("");
  const [anthropicDraft, setAnthropicDraft] = useState("");
  const [openaiDraft, setOpenaiDraft] = useState("");
  const [llmErr, setLlmErr] = useState<string | null>(null);
  const [llmSaved, setLlmSaved] = useState<string | null>(null);
  const [llmBusy, setLlmBusy] = useState(false);

  useEffect(() => {
    auth.me().then((m) => {
      setMe(m);
      setCompany(m.company);
      setProvider(m.llm_provider);
      setModel(m.llm_model);
    }).catch(() => setErr("could not load account"));
  }, []);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setBusy(true);
    try {
      const updated = await api<Me>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ company }),
      });
      setMe(updated);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError) setErr(`could not save (${e.status})`);
      else setErr("could not save");
    } finally {
      setBusy(false);
    }
  }

  async function patchLlm(payload: Record<string, string>, message: string) {
    setLlmErr(null);
    setLlmSaved(null);
    setLlmBusy(true);
    try {
      const updated = await api<Me>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMe(updated);
      setProvider(updated.llm_provider);
      setModel(updated.llm_model);
      setAnthropicDraft("");
      setOpenaiDraft("");
      setLlmSaved(message);
    } catch (e) {
      if (e instanceof ApiError) {
        const data = e.data as Record<string, unknown> | null;
        const fieldMsg =
          (Array.isArray(data?.anthropic_api_key) && String(data!.anthropic_api_key[0])) ||
          (Array.isArray(data?.openai_api_key) && String(data!.openai_api_key[0])) ||
          `could not save (${e.status})`;
        setLlmErr(fieldMsg);
      } else {
        setLlmErr("could not save");
      }
    } finally {
      setLlmBusy(false);
    }
  }

  function saveLlm(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = {
      llm_provider: provider,
      llm_model: model,
    };
    if (anthropicDraft.trim()) payload.anthropic_api_key = anthropicDraft.trim();
    if (openaiDraft.trim()) payload.openai_api_key = openaiDraft.trim();
    void patchLlm(payload, "llm settings saved.");
  }

  function clearKey(which: LlmProvider) {
    void patchLlm(
      which === "openai" ? { openai_api_key: "" } : { anthropic_api_key: "" },
      `${which} key cleared.`,
    );
  }

  if (!me) return <p className="fine">loading…</p>;

  const activeKeySet = provider === "openai" ? me.has_openai_key : me.has_anthropic_key;

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 640 }}>
      <form onSubmit={saveAccount} style={{ background: "var(--bg-1)", border: "1px solid var(--hairline)", borderRadius: 6, padding: 28 }}>
        <div className="eyebrow">account</div>
        <h2 className="mono" style={{ fontSize: 19, marginTop: 14, marginBottom: 24, color: "var(--ink)" }}>
          your <span style={{ color: "var(--lime)" }}>signature</span>
        </h2>

        {err && <div className="form-error">{err}</div>}
        {saved && (
          <div style={{ background: "var(--lime-soft)", border: "1px solid var(--lime-soft)", color: "var(--lime)", fontFamily: "var(--mono)", fontSize: 14, padding: "10px 12px", borderRadius: 4, marginBottom: 14 }}>
            ● saved.
          </div>
        )}

        <div className="field">
          <label>email</label>
          <input type="email" value={me.email} disabled style={{ opacity: 0.6 }} />
          <span className="help">~ contact support to change your email.</span>
        </div>

        <div className="field">
          <label>company</label>
          <input type="text" value={company} placeholder="your company"
            onChange={(e) => setCompany(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-lime" disabled={busy} style={{ justifyContent: "center" }}>
          {busy ? "saving…" : "save changes →"}
        </button>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--hairline)" }}>
          <div className="mono fine" style={{ marginBottom: 8 }}>member since</div>
          <div className="mono" style={{ fontSize: 15, color: "var(--lime)" }}>
            {new Date(me.created_at).toLocaleDateString()}
          </div>
          {me.last_login && (
            <div className="mono fine" style={{ marginTop: 8 }}>
              last sign-in {new Date(me.last_login).toLocaleString()}
            </div>
          )}
        </div>
      </form>

      <form onSubmit={saveLlm} style={{ background: "var(--bg-1)", border: "1px solid var(--hairline)", borderRadius: 6, padding: 28 }}>
        <div className="eyebrow">llm provider</div>
        <h2 className="mono" style={{ fontSize: 19, marginTop: 14, marginBottom: 10, color: "var(--ink)" }}>
          which <span style={{ color: "var(--lime)" }}>brain</span> powers your audits
        </h2>
        <p className="mono" style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 20 }}>
          ~ bandit calls anthropic or openai with your key. keys never leave the api server, never appear in any client bundle.
        </p>

        {llmErr && <div className="form-error">{llmErr}</div>}
        {llmSaved && (
          <div style={{ background: "var(--lime-soft)", border: "1px solid var(--lime-soft)", color: "var(--lime)", fontFamily: "var(--mono)", fontSize: 14, padding: "10px 12px", borderRadius: 4, marginBottom: 14 }}>
            ● {llmSaved}
          </div>
        )}

        <div className="field">
          <label>provider</label>
          <div className="provider-toggle">
            <button
              type="button"
              className={provider === "anthropic" ? "active" : ""}
              onClick={() => { setProvider("anthropic"); setModel(""); }}
            >
              anthropic <span className="provider-sub">claude</span>
            </button>
            <button
              type="button"
              className={provider === "openai" ? "active" : ""}
              onClick={() => { setProvider("openai"); setModel(""); }}
            >
              openai <span className="provider-sub">chatgpt</span>
            </button>
          </div>
          <span className="help">
            ~ audits will call {provider === "openai" ? "openai" : "anthropic"} with the {activeKeySet ? "key you've set below" : "server-wide key (if configured)"}.
          </span>
        </div>

        <div className="field">
          <label>model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS[provider].map((m) => (
              <option key={m.value || "default"} value={m.value}>
                {m.label}{m.hint ? `  ·  ${m.hint}` : ""}
              </option>
            ))}
          </select>
          <span className="help">~ leave on default unless you want a specific model.</span>
        </div>

        <div className="field">
          <label>anthropic api key</label>
          {me.has_anthropic_key ? (
            <div className="key-status set">
              <span>{me.anthropic_key_preview}</span>
              <button type="button" className="key-clear" onClick={() => clearKey("anthropic")} disabled={llmBusy}>
                clear
              </button>
            </div>
          ) : (
            <div className="key-status unset">no key set</div>
          )}
          <input
            type="password"
            value={anthropicDraft}
            placeholder={me.has_anthropic_key ? "replace with new key (sk-ant-...)" : "sk-ant-..."}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAnthropicDraft(e.target.value)}
          />
          <span className="help">~ from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--lime)" }}>console.anthropic.com</a>.</span>
        </div>

        <div className="field">
          <label>openai api key</label>
          {me.has_openai_key ? (
            <div className="key-status set">
              <span>{me.openai_key_preview}</span>
              <button type="button" className="key-clear" onClick={() => clearKey("openai")} disabled={llmBusy}>
                clear
              </button>
            </div>
          ) : (
            <div className="key-status unset">no key set</div>
          )}
          <input
            type="password"
            value={openaiDraft}
            placeholder={me.has_openai_key ? "replace with new key (sk-...)" : "sk-..."}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setOpenaiDraft(e.target.value)}
          />
          <span className="help">~ from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--lime)" }}>platform.openai.com</a>.</span>
        </div>

        <button type="submit" className="btn btn-lime" disabled={llmBusy} style={{ justifyContent: "center" }}>
          {llmBusy ? "saving…" : "save llm settings →"}
        </button>
      </form>
    </div>
  );
}
