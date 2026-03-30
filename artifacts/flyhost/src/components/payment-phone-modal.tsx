import { useState, useEffect } from "react";

const accent = "#FACC15";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";

interface PaymentPhoneModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (phone: string) => void;
  loading?: boolean;
  title: string;
  description: string;
  amount: number;
  currency?: string;
}

const PHONE_STORAGE_KEY = "flyhost_last_phone";

const COUNTRY_CODES = [
  { code: "+237", flag: "🇨🇲", name: "Cameroun", placeholder: "6XX XXX XXX" },
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire", placeholder: "07 XX XX XX XX" },
  { code: "+221", flag: "🇸🇳", name: "Sénégal", placeholder: "7X XXX XX XX" },
  { code: "+223", flag: "🇲🇱", name: "Mali", placeholder: "7X XX XX XX" },
  { code: "+226", flag: "🇧🇫", name: "Burkina Faso", placeholder: "7X XX XX XX" },
  { code: "+228", flag: "🇹🇬", name: "Togo", placeholder: "9X XX XX XX" },
  { code: "+229", flag: "🇧🇯", name: "Bénin", placeholder: "9X XX XX XX" },
  { code: "+236", flag: "🇨🇫", name: "Centrafrique", placeholder: "7X XX XX XX" },
  { code: "+242", flag: "🇨🇬", name: "Congo-Brazza", placeholder: "06 XXX XX XX" },
  { code: "+243", flag: "🇨🇩", name: "RDC", placeholder: "8X XXX XXXX" },
  { code: "+241", flag: "🇬🇦", name: "Gabon", placeholder: "07 XX XX XX" },
  { code: "+240", flag: "🇬🇶", name: "Guinée Équat.", placeholder: "222 XXX XXX" },
  { code: "+224", flag: "🇬🇳", name: "Guinée", placeholder: "6XX XX XX XX" },
  { code: "+245", flag: "🇬🇼", name: "Guinée-Bissau", placeholder: "7X XXX XXX" },
];

export default function PaymentPhoneModal({
  open, onClose, onConfirm, loading,
  title, description, amount, currency = "FCFA"
}: PaymentPhoneModalProps) {
  const [countryCode, setCountryCode] = useState("+237");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [showCountries, setShowCountries] = useState(false);

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(PHONE_STORAGE_KEY);
      if (saved) {
        const match = COUNTRY_CODES.find(c => saved.startsWith(c.code));
        if (match) {
          setCountryCode(match.code);
          setPhone(saved.slice(match.code.length).trim());
        } else {
          setPhone(saved);
        }
      }
      setPhoneError("");
    }
  }, [open]);

  function validate() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) {
      setPhoneError("Numéro trop court");
      return false;
    }
    setPhoneError("");
    return true;
  }

  function handleConfirm() {
    if (!validate()) return;
    const full = `${countryCode}${phone.replace(/\s/g, "")}`;
    localStorage.setItem(PHONE_STORAGE_KEY, full);
    onConfirm(full);
  }

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "#111113", border: `1px solid ${border}`,
        borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "440px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: "28px" }}>💳</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "18px" }}>{title}</div>
              <div style={{ fontSize: "13px", color: "#71717A" }}>{description}</div>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#71717A", cursor: "pointer", fontSize: "20px", padding: "4px" }}
            >✕</button>
          )}
        </div>

        {/* Amount */}
        <div style={{
          background: "rgba(250,204,21,0.08)", border: `1px solid ${border}`,
          borderRadius: "14px", padding: "16px 20px", marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: "#A1A1AA", fontSize: "14px" }}>Montant à payer</span>
          <span style={{ fontSize: "22px", fontWeight: 800, color: accent }}>
            {amount.toLocaleString("fr-FR")} {currency}
          </span>
        </div>

        {/* Phone input */}
        <div style={{ marginBottom: "8px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "#E4E4E7" }}>
            📱 Numéro Mobile Money
          </label>

          <div style={{ display: "flex", gap: "8px" }}>
            {/* Country selector */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowCountries(!showCountries)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "12px 10px", background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${border}`, borderRadius: "12px",
                  color: "#E4E4E7", cursor: "pointer", fontFamily: "inherit",
                  fontSize: "14px", fontWeight: 600, whiteSpace: "nowrap",
                  minWidth: "90px",
                }}
              >
                {selectedCountry.flag} {selectedCountry.code}
                <span style={{ fontSize: "10px", color: "#71717A" }}>▼</span>
              </button>

              {showCountries && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                  background: "#1A1A1F", border: `1px solid ${border}`, borderRadius: "12px",
                  maxHeight: "220px", overflowY: "auto", minWidth: "200px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}>
                  {COUNTRY_CODES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountryCode(c.code); setShowCountries(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        width: "100%", padding: "10px 14px", background: "none",
                        border: "none", color: c.code === countryCode ? accent : "#E4E4E7",
                        cursor: "pointer", fontFamily: "inherit", fontSize: "13px",
                        textAlign: "left",
                      }}
                    >
                      {c.flag} {c.code} <span style={{ color: "#71717A" }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone number */}
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneError(""); }}
              placeholder={selectedCountry.placeholder}
              style={{
                flex: 1, padding: "12px 14px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${phoneError ? error : border}`,
                borderRadius: "12px", color: "#E4E4E7",
                fontFamily: "inherit", fontSize: "15px", outline: "none",
              }}
              onKeyDown={e => e.key === "Enter" && handleConfirm()}
              autoFocus
            />
          </div>

          {phoneError && (
            <p style={{ color: error, fontSize: "12px", marginTop: "6px" }}>{phoneError}</p>
          )}

          <p style={{ color: "#71717A", fontSize: "12px", marginTop: "8px" }}>
            Ce numéro sera utilisé pour le paiement Mobile Money (MTN, Orange, etc.)
          </p>
        </div>

        {/* Security notice */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: "10px", padding: "10px 14px", marginBottom: "24px",
          fontSize: "12px", color: green,
        }}>
          🔒 Paiement sécurisé via MoneyFusion — Vos données sont protégées
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            disabled={!!loading}
            style={{
              flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)",
              border: `1px solid ${border}`, borderRadius: "14px",
              color: "#A1A1AA", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: "15px", fontWeight: 600,
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!loading}
            style={{
              flex: 2, padding: "14px",
              background: loading ? "rgba(250,204,21,0.4)" : accent,
              border: "none", borderRadius: "14px",
              color: loading ? "#71717A" : "#09090B",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: "15px", fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #09090B", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Traitement...
              </>
            ) : (
              <>💰 Payer {amount.toLocaleString("fr-FR")} {currency}</>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
