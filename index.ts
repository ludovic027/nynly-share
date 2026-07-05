// invoice-generator/index.ts — V1 FINAL
// Génération automatique des reçus de mission + récapitulatifs annuels
// Envoi par email via Resend — bilingue FR/EN — conforme SAP France + USA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { cors, env, db, sendEmail, log, CORS, FROM_EMAIL } from "../_shared/utils.ts"

const APP_URL  = Deno.env.get("APP_URL") || "https://nynly.app"
const ADMIN    = Deno.env.get("ADMIN_EMAIL") || ""

// ── Numéro SAP France (à configurer quand agrément obtenu) ───
const SAP_AGREEMENT = Deno.env.get("SAP_AGREEMENT_NUMBER") || ""
const SAP_RATE      = 0.50   // 50% crédit d'impôt France
const COMMISSION    = 0.12   // 12% commission Nynly

// ── INVOICEGENERATOR — System prompt (reference, no Claude call) ──
const INVOICE_SYSTEM = `=== NYNLY CORE FACTS (single source of truth — never contradict) ===
- Workers: ALWAYS free. Nynly takes 12% commission on completed missions only.
- Tips: 100% to the worker, 0% Nynly commission.
- Cancellation fees: 25% under 24h, 50% under 4h.
- Families: 6 months FREE, then the monthly price given in MARKET CONTEXT
  (e.g. $9.90 USD in US markets, $13.90 CAD in Canada).
- Referral credit: $40 background-check credit after 2 active referrals.
9. CANADA: prices always in CAD with "CAD" stated. Quebec (Montréal):
   French-FIRST in all consumer content (Bill 96) — produce FR as the
   primary version, EN second. Background checks in Canada are NOT Checkr:
   say "our Canadian verification partner". Mention taxes when quoting
   totals (HST/GST/QST vary by province).
10. Senior care is non-medical companion care in EVERY market. US: AHCA
    (FL) and state equivalents. Canada: same positioning, stricter wording.
=== END CORE FACTS ===

You are InvoiceGenerator. You produce mission receipts and annual fiscal
summaries. You are the ONE agent where creativity is forbidden: numbers
come from the database, never from inference.

RECEIPT RULES:
- Line items: service, date, duration, hourly rate, subtotal, tip (if any,
  labeled "Tip -- 100% to your provider"), cancellation fee (if any, with
  the rule applied: "25% -- cancelled under 24h"), total charged.
- Worker copy shows: gross, Nynly commission (12% or 0% if commission-free
  period, state which), background-check credit applied if any, net paid.
- Family copy NEVER shows the worker's commission breakdown.
- Currency: USD, two decimals, always.
- If any required field is missing/null -> output { "error": "missing:
  <field>" } and stop. NEVER estimate or fill in.
- FR/EN/ES per user language. Dates: US format (MM/DD/YYYY) for US users,
  FR format (DD/MM/YYYY) for FR users.

OUTPUT FORMAT: JSON { "document_type", "html", "totals": {}, "language" }`

// ═══════════════════════════════════════════════════════════════
// LABELS SERVICES — Bilingue
// ═══════════════════════════════════════════════════════════════
const SERVICE_LABELS: Record<string, { fr: string; en: string; sap: boolean }> = {
  childcare:  { fr: "Garde d'enfants",            en: "Childcare",            sap: true  },
  petsitter:  { fr: "Garde d'animaux",             en: "Pet Care",             sap: false },
  seniorcare: { fr: "Aide à la personne (senior)", en: "Senior Care",          sap: true  },
  cleaning:   { fr: "Entretien du domicile",       en: "Home Cleaning",        sap: true  },
  handyman:   { fr: "Petits travaux / bricolage",  en: "Handyman Services",    sap: true  },
  lawn:       { fr: "Jardinage",                   en: "Lawn Care",            sap: true  },
  errands:    { fr: "Courses et assistance",        en: "Errands & Assistance", sap: true  },}

// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION HTML — Reçu de mission
// ═══════════════════════════════════════════════════════════════
function buildReceiptHTML(data: {
  invoiceNumber:  string
  invoiceDate:    string
  missionDate:    string
  serviceLabel:   string
  durationHours:  number
  hourlyRate:     number
  amountGross:    number
  commissionAmt:  number
  amountWorker:   number
  currency:       string
  currencySymbol: string
  workerName:     string
  clientName:     string
  city:           string
  countryCode:    string
  isSAP:          boolean
  sapAgreement:   string
  taxCreditAmt:   number
  recipientRole:  "worker" | "client"
}): string {
  const isFR    = data.countryCode === "FR"
  const isWorker = data.recipientRole === "worker"
  const sym     = data.currencySymbol

  const fmt = (n: number) => `${sym}${n.toFixed(2)}`

  return `<!DOCTYPE html>
<html lang="${isFR ? 'fr' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isFR ? 'Reçu de mission' : 'Mission Receipt'} — ${data.invoiceNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;color:#1a1a1a;padding:20px}
    .page{max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#2ecc71,#27ae60);padding:36px 40px;position:relative;overflow:hidden}
    .header::after{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,.08);border-radius:50%}
    .logo{font-size:32px;font-weight:900;color:white;letter-spacing:-0.5px;margin-bottom:6px}
    .doc-type{font-size:14px;color:rgba(255,255,255,.8);font-weight:500}
    .invoice-num{font-size:13px;color:rgba(255,255,255,.7);margin-top:4px}
    .body{padding:36px 40px}
    .section{margin-bottom:28px}
    .section-title{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f3f4f6}
    .row{display:block;overflow:hidden;align-items:center;padding:10px 0;border-bottom:1px solid #f9fafb}
    .row:last-child{border-bottom:none}
    .row-label{font-size:13px;color:#6b7280}
    .row-value{font-size:13px;font-weight:600;color:#111827;float:right}
    .parties-grid{display:block}
    .party-box{background:#f9fafb;border-radius:12px;padding:16px}
    .party-role{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
    .party-name{font-size:15px;font-weight:700;color:#111827}
    .amounts-box{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:20px;margin:20px 0}
    .amount-main{font-size:28px;font-weight:900;color:#15803d;margin-bottom:4px}
    .amount-label{font-size:12px;color:#16a34a;font-weight:500}
    .breakdown{margin-top:14px;padding-top:14px;border-top:1px solid #bbf7d0}
    .breakdown-row{display:block;overflow:hidden;padding:4px 0;font-size:12px}
    .breakdown-label{color:#6b7280}
    .breakdown-value{font-weight:600;color:#374151;float:right}
    .sap-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:18px;margin:20px 0}
    .sap-title{font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:8px}
    .sap-text{font-size:12px;color:#1e40af;line-height:1.6}
    .sap-credit{font-size:18px;font-weight:800;color:#1d4ed8;margin-top:8px}
    .us-box{background:#fffbeb;border:1.5px solid #fde68a;border-radius:14px;padding:18px;margin:20px 0}
    .us-title{font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px}
    .us-text{font-size:12px;color:#78350f;line-height:1.6}
    .footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6}
    .footer-text{font-size:11px;color:#9ca3af;line-height:1.6}
    .footer-link{color:#2ecc71;text-decoration:none;font-weight:600}
    @media(max-width:480px){
      .body{padding:24px 20px}
      .parties-grid{}
      .header{padding:28px 24px}
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="logo">Nynly</div>
    <div class="doc-type">${isFR ? 'Reçu de mission' : 'Mission Receipt'}</div>
    <div class="invoice-num">${data.invoiceNumber} · ${data.invoiceDate}</div>
  </div>

  <div class="body">
    <!-- Parties -->
    <div class="section">
      <div class="section-title">${isFR ? 'Parties' : 'Parties'}</div>
      <div class="parties-grid">
        <div class="party-box">
          <div class="party-role">${isFR ? 'Prestataire' : 'Service Provider'}</div>
          <div class="party-name">${data.workerName}</div>
        </div>
        <div class="party-box">
          <div class="party-role">${isFR ? 'Famille / Employeur' : 'Family / Employer'}</div>
          <div class="party-name">${data.clientName}</div>
        </div>
      </div>
    </div>

    <!-- Détail mission -->
    <div class="section">
      <div class="section-title">${isFR ? 'Détail de la mission' : 'Mission Details'}</div>
      <div class="row">
        <span class="row-label">${isFR ? 'Service' : 'Service'}</span>
        <span class="row-value">${data.serviceLabel}</span>
      </div>
      <div class="row">
        <span class="row-label">${isFR ? 'Date de la mission' : 'Mission Date'}</span>
        <span class="row-value">${data.missionDate}</span>
      </div>
      <div class="row">
        <span class="row-label">${isFR ? 'Durée' : 'Duration'}</span>
        <span class="row-value">${data.durationHours}h</span>
      </div>
      <div class="row">
        <span class="row-label">${isFR ? 'Tarif horaire' : 'Hourly Rate'}</span>
        <span class="row-value">${fmt(data.hourlyRate)}/h</span>
      </div>
      <div class="row">
        <span class="row-label">${isFR ? 'Ville' : 'City'}</span>
        <span class="row-value">${data.city}</span>
      </div>
    </div>

    <!-- Montants -->
    <div class="amounts-box">
      ${isWorker ? `
      <div class="amount-label">${isFR ? 'Montant reçu (88%)' : 'Amount Received (88%)'}</div>
      <div class="amount-main">${fmt(data.amountWorker)}</div>
      ` : `
      <div class="amount-label">${isFR ? 'Montant total payé' : 'Total Amount Paid'}</div>
      <div class="amount-main">${fmt(data.amountGross)}</div>
      `}
      <div class="breakdown">
        <div class="breakdown-row">
          <span class="breakdown-label">${isFR ? 'Montant brut mission' : 'Gross Mission Amount'}</span>
          <span class="breakdown-value">${fmt(data.amountGross)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">${isFR ? 'Commission Nynly (12%)' : 'Nynly Fee (12%)'}</span>
          <span class="breakdown-value">-${fmt(data.commissionAmt)}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">${isFR ? 'Reversé au prestataire' : 'Paid to Provider'}</span>
          <span class="breakdown-value" style="color:#15803d;font-weight:700">${fmt(data.amountWorker)}</span>
        </div>
      </div>
    </div>

    <!-- Mention SAP France (client uniquement) -->
    ${isFR && !isWorker && data.isSAP ? `
    <div class="sap-box">
      <div class="sap-title">🇫🇷 Service à la Personne — Avantage fiscal</div>
      <div class="sap-text">
        Cette prestation est éligible au <strong>crédit d'impôt de 50%</strong> sur les dépenses de services à la personne (article 199 sexdecies du CGI).
        ${data.sapAgreement ? `<br/>N° d'agrément SAP : <strong>${data.sapAgreement}</strong>` : ''}
        <br/>Conservez ce document pour votre déclaration de revenus.
      </div>
      <div class="sap-credit">Crédit d'impôt estimé : ${fmt(data.taxCreditAmt)}</div>
      <div class="sap-text" style="margin-top:6px;font-size:11px">
        * Montant indicatif. Consultez votre conseiller fiscal. Plafond annuel: 12 000€ (+ 1 500€/enfant à charge).
      </div>
    </div>` : ''}

    <!-- Info fiscale USA (worker uniquement) -->
    ${!isFR && isWorker ? `
    <div class="us-box">
      <div class="us-title">🇺🇸 Tax Information</div>
      <div class="us-text">
        Your earnings on Nynly are considered self-employment income.
        If your annual earnings exceed <strong>$600</strong>, Nynly will issue a <strong>1099-K form</strong> via Stripe.
        Keep this receipt for your tax records. Consider setting aside ~25-30% for self-employment taxes.
        <br/><br/><strong>Recurring clients:</strong> If you earn more than <strong>$2,700/year from the same family</strong>, that family may be your employer under IRS Nanny Tax rules (Schedule H + Form W-2 required). Consult a tax professional.
        <br/><br/>Questions? Visit <a href="https://irs.gov" style="color:#92400e">irs.gov</a> or consult a CPA.
      </div>
    </div>` : ''}

    <!-- Info fiscale USA (client uniquement) -->
    ${!isFR && !isWorker ? `
    <div class="us-box">
      <div class="us-title">🇺🇸 Tax Information</div>
      <div class="us-text">
        Childcare expenses may be eligible for the <strong>Child and Dependent Care Tax Credit</strong> (up to 35% of eligible expenses, max $3,000/child).
        Keep this receipt for your records. Consult a tax professional for details.
      </div>
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">
      Nynly · <a href="${APP_URL}" class="footer-link">nynly.app</a><br/>
      ${isFR
        ? 'Plateforme de mise en relation — les prestataires sont des travailleurs indépendants.'
        : 'Marketplace platform — service providers are independent contractors.'}<br/>
      ${isFR ? 'Document généré automatiquement' : 'Automatically generated document'} · ${data.invoiceNumber}
    </div>
  </div>
</div>
</body>
</html>`
}

// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION HTML — Récapitulatif annuel
// ═══════════════════════════════════════════════════════════════
function buildAnnualHTML(data: {
  year:           number
  userRole:       "worker" | "client"
  userName:       string
  countryCode:    string
  totalMissions:  number
  totalHours:     number
  totalGross:     number
  totalCommission:number
  totalNet:       number
  totalSAP:       number
  totalTaxCredit: number
  currency:       string
  currencySymbol: string
  topServices:    Array<{ label: string; count: number; amount: number }>
}): string {
  const isFR     = data.countryCode === "FR"
  const isWorker = data.userRole === "worker"
  const sym      = data.currencySymbol
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`

  return `<!DOCTYPE html>
<html lang="${isFR ? 'fr' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isFR ? 'Récapitulatif fiscal' : 'Annual Tax Summary'} ${data.year} — Nynly</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;color:#1a1a1a;padding:20px}
    .page{max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#0f172a,#1e293b);padding:36px 40px}
    .logo{font-size:28px;font-weight:900;color:white;margin-bottom:6px}
    .doc-type{font-size:16px;color:rgba(255,255,255,.7);font-weight:500}
    .year-badge{display:inline-block;background:#2ecc71;color:white;font-size:22px;font-weight:900;padding:8px 20px;border-radius:99px;margin-top:12px}
    .body{padding:36px 40px}
    .kpis{display:block;margin-bottom:28px}
    .kpi{background:#f9fafb;border-radius:14px;padding:16px;text-align:center;border:1.5px solid #e5e7eb}
    .kpi-val{font-size:22px;font-weight:900;margin-bottom:4px}
    .kpi-label{font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
    .section{margin-bottom:28px}
    .section-title{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f3f4f6}
    .row{display:block;overflow:hidden;align-items:center;padding:10px 0;border-bottom:1px solid #f9fafb}
    .row:last-child{border-bottom:none}
    .row-label{font-size:13px;color:#6b7280}
    .row-value{font-size:13px;font-weight:700;color:#111827;float:right}
    .highlight-box{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:20px;margin:16px 0;text-align:center}
    .highlight-val{font-size:32px;font-weight:900;color:#15803d}
    .highlight-label{font-size:13px;color:#16a34a;margin-top:4px}
    .sap-box{background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:20px;margin:16px 0}
    .sap-title{font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:10px}
    .sap-credit{font-size:28px;font-weight:900;color:#1d4ed8}
    .sap-text{font-size:12px;color:#1e40af;line-height:1.6;margin-top:8px}
    .us-box{background:#fffbeb;border:1.5px solid #fde68a;border-radius:14px;padding:20px;margin:16px 0}
    .services-list{margin-top:8px}
    .svc-row{display:block;overflow:hidden;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
    .svc-row:last-child{border-bottom:none}
    .footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6}
    .footer-text{font-size:11px;color:#9ca3af;line-height:1.6}
    @media(max-width:480px){.kpis{}.body{padding:24px 20px}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">Nynly</div>
    <div class="doc-type">
      ${isFR
        ? (isWorker ? 'Récapitulatif fiscal annuel — Prestataire' : 'Récapitulatif fiscal annuel — Employeur')
        : (isWorker ? 'Annual Tax Summary — Service Provider' : 'Annual Tax Summary — Family')}
    </div>
    <div class="year-badge">${data.year}</div>
  </div>

  <div class="body">
    <!-- KPIs -->
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-val" style="color:#2ecc71">${data.totalMissions}</div>
        <div class="kpi-label">${isFR ? 'Missions' : 'Missions'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#3b82f6">${data.totalHours.toFixed(0)}h</div>
        <div class="kpi-label">${isFR ? 'Heures' : 'Hours'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#f59e0b">${fmt(data.totalGross)}</div>
        <div class="kpi-label">${isFR ? 'Volume total' : 'Total Volume'}</div>
      </div>
    </div>

    <!-- Bilan financier -->
    <div class="section">
      <div class="section-title">${isFR ? 'Bilan financier' : 'Financial Summary'}</div>
      <div class="row">
        <span class="row-label">${isFR ? 'Montant total des missions' : 'Total Mission Amount'}</span>
        <span class="row-value">${fmt(data.totalGross)}</span>
      </div>
      <div class="row">
        <span class="row-label">${isFR ? 'Commission Nynly (12%)' : 'Nynly Fee (12%)'}</span>
        <span class="row-value">-${fmt(data.totalCommission)}</span>
      </div>
      ${isWorker ? `
      <div class="row">
        <span class="row-label" style="color:#15803d;font-weight:700">${isFR ? 'Revenus nets reçus' : 'Net Earnings Received'}</span>
        <span class="row-value" style="color:#15803d">${fmt(data.totalNet)}</span>
      </div>` : `
      <div class="row">
        <span class="row-label" style="color:#1d4ed8;font-weight:700">${isFR ? 'Dépenses nettes services' : 'Net Service Expenses'}</span>
        <span class="row-value" style="color:#1d4ed8">${fmt(data.totalNet)}</span>
      </div>`}
    </div>

    <!-- Montant net mis en valeur -->
    <div class="highlight-box">
      <div class="highlight-val">${fmt(isWorker ? data.totalNet : data.totalGross)}</div>
      <div class="highlight-label">
        ${isWorker
          ? (isFR ? 'Revenus Nynly à déclarer en ' + data.year : 'Nynly earnings to declare for ' + data.year)
          : (isFR ? 'Dépenses Nynly en ' + data.year : 'Total Nynly expenses in ' + data.year)}
      </div>
    </div>

    <!-- Avantage fiscal France SAP -->
    ${isFR && !isWorker && data.totalSAP > 0 ? `
    <div class="sap-box">
      <div class="sap-title">🇫🇷 Avantage fiscal — Services à la Personne</div>
      <div class="sap-credit">Crédit d'impôt estimé : ${fmt(data.totalTaxCredit)}</div>
      <div class="sap-text">
        <strong>${fmt(data.totalSAP)}</strong> de dépenses sont éligibles au crédit d'impôt de 50% (art. 199 sexdecies CGI).
        ${SAP_AGREEMENT ? `<br/>N° agrément SAP : <strong>${SAP_AGREEMENT}</strong>` : ''}
        <br/><br/>Reportez le montant de <strong>${fmt(data.totalGross)}</strong> dans votre déclaration de revenus 
        (case 7DB ou équivalent selon votre situation). Le crédit d'impôt de <strong>${fmt(data.totalTaxCredit)}</strong> 
        sera déduit de votre impôt ou remboursé.
        <br/><br/><em>* Consultez impots.gouv.fr ou votre conseiller fiscal. 
        Plafond : 12 000€/an + 1 500€/enfant à charge.</em>
      </div>
    </div>` : ''}

    <!-- Info fiscale USA worker -->
    ${!isFR && isWorker ? `
    <div class="us-box">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:10px">🇺🇸 Tax Information — Self-Employment</div>
      <div style="font-size:13px;color:#78350f;line-height:1.7">
        Your total Nynly earnings in ${data.year}: <strong>${fmt(data.totalNet)}</strong><br/>
        ${data.totalNet >= 600
          ? `✅ A <strong>1099-K form</strong> will be issued by Stripe for your earnings above $600.`
          : `ℹ️ Earnings under $600 — no 1099-K required, but income must still be reported.`}
        <br/><br/>
        Remember to deduct eligible business expenses (phone data used for work, transportation, etc.).
        Self-employment tax rate: ~15.3% + income tax. Consider quarterly estimated payments.
      </div>
    </div>` : ''}

    <!-- Info fiscale USA client -->
    ${!isFR && !isWorker ? `
    <div class="us-box">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:10px">🇺🇸 Tax Information — Childcare Deductions</div>
      <div style="font-size:13px;color:#78350f;line-height:1.7">
        Your total childcare expenses via Nynly in ${data.year}: <strong>${fmt(data.totalGross)}</strong><br/><br/>
        You may be eligible for the <strong>Child and Dependent Care Tax Credit</strong>:
        up to 35% of eligible childcare expenses (max $3,000/child, $6,000/two+ children).
        <br/><br/>
        Also check if your employer offers a <strong>Dependent Care FSA</strong> — up to $5,000 pre-tax annually.
        <br/><em>Consult a tax professional. Keep this document for your records.</em>
      </div>
    </div>` : ''}

    <!-- Services utilisés -->
    ${data.topServices.length > 0 ? `
    <div class="section">
      <div class="section-title">${isFR ? 'Détail par service' : 'Breakdown by Service'}</div>
      <div class="services-list">
        ${data.topServices.map(s => `
        <div class="svc-row">
          <span style="color:#374151">${s.label} (${s.count} ${isFR ? 'mission' : 'mission'}${s.count > 1 ? 's' : ''})</span>
          <span style="font-weight:700">${sym}${s.amount.toFixed(2)}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}
  </div>

  <div class="footer">
    <div class="footer-text">
      Nynly · <a href="${APP_URL}" style="color:#2ecc71;text-decoration:none;font-weight:600">nynly.app</a><br/>
      ${isFR
        ? 'Ce document est généré automatiquement. Conservez-le pour votre déclaration fiscale.'
        : 'This document is auto-generated. Keep it for your tax records.'}<br/>
      ${isFR ? 'Exercice fiscal' : 'Fiscal year'} ${data.year} · Nynly
    </div>
  </div>
</div>
</body>
</html>`
}

// ═══════════════════════════════════════════════════════════════
// SERVE
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  const cr = cors(req)
  if (cr) return cr
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS })

  const body = await req.json().catch(() => ({}))
  const { type, contract_id, user_id, year } = body

  // ── TYPE 1 : Reçu de mission ──────────────────────────────
  if (type === "receipt" && contract_id) {
    try {
      // Charger le contrat
      const contracts = await db(
        `contracts?id=eq.${encodeURIComponent(contract_id)}&select=*&limit=1`
      )
      const contract = Array.isArray(contracts) ? contracts[0] : null
      if (!contract) throw new Error("Contract not found: " + contract_id)

      // Charger worker et client
      const [workers, clients] = await Promise.all([
        db(`profiles?id=eq.${encodeURIComponent(contract.worker_id)}&select=id,first_name,last_name,email,city,detected_country&limit=1`),
        db(`profiles?id=eq.${encodeURIComponent(contract.client_id)}&select=id,first_name,last_name,email,city,detected_country&limit=1`),
      ])
      const worker = Array.isArray(workers) ? workers[0] : null
      const client = Array.isArray(clients) ? clients[0] : null
      if (!worker || !client) throw new Error("Worker or client not found")

      // Calculs
      const amountGross    = parseFloat(contract.total_amount || 0)
      const commissionAmt  = parseFloat((amountGross * COMMISSION).toFixed(2))
      const amountWorker   = parseFloat((amountGross - commissionAmt).toFixed(2))
      const durationHours  = parseFloat(contract.duration_minutes || 0) / 60
      const hourlyRate     = durationHours > 0 ? amountGross / durationHours : 0

      // Info service + pays
      const countryCode    = worker.detected_country || client.detected_country || "US"
      const isFR           = countryCode === "FR"
      const svcInfo        = SERVICE_LABELS[contract.service_type] || { fr: contract.service_type, en: contract.service_type, sap: false }
      const serviceLabel   = isFR ? svcInfo.fr : svcInfo.en
      const isSAP          = isFR && svcInfo.sap
      const currencySymbol = isFR ? "€" : "$"
      const currency       = isFR ? "EUR" : "USD"
      const taxCreditAmt   = isSAP ? parseFloat((amountGross * SAP_RATE).toFixed(2)) : 0

      // Formater les dates
      const missionDate    = new Date(contract.completed_at || contract.created_at)
        .toLocaleDateString(isFR ? "fr-FR" : "en-US", { year:"numeric", month:"long", day:"numeric" })
      const invoiceDate    = new Date().toLocaleDateString(isFR ? "fr-FR" : "en-US", { year:"numeric", month:"long", day:"numeric" })
      const invoiceNumber  = `NYN-${new Date().getFullYear()}-${String(Math.floor(Math.random()*99999)).padStart(5,'0')}`

      // Noms complets
      const workerName = `${worker.first_name || ""} ${worker.last_name || ""}`.trim()
      const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim()

      const baseData = {
        invoiceNumber, invoiceDate, missionDate, serviceLabel,
        durationHours, hourlyRate, amountGross, commissionAmt, amountWorker,
        currency, currencySymbol, workerName, clientName,
        city: worker.city || client.city || "Tampa",
        countryCode, isSAP, sapAgreement: SAP_AGREEMENT, taxCreditAmt,
      }

      // Générer HTML pour worker et client
      const htmlWorker = buildReceiptHTML({ ...baseData, recipientRole: "worker" })
      const htmlClient = buildReceiptHTML({ ...baseData, recipientRole: "client" })

      // Sauvegarder en base
      await db("invoices", {
        method: "POST",
        body: JSON.stringify({
          contract_id, invoice_number: invoiceNumber,
          worker_id: contract.worker_id, client_id: contract.client_id,
          service_type: contract.service_type, service_label: serviceLabel,
          mission_date: contract.completed_at || contract.created_at,
          duration_hours: durationHours, hourly_rate: hourlyRate,
          amount_gross: amountGross, commission_amount: commissionAmt, amount_worker: amountWorker,
          currency, currency_symbol: currencySymbol,
          city: worker.city || "Tampa", country_code: countryCode, country_name: isFR ? "France" : "United States",
          is_sap_eligible: isSAP, sap_agreement_num: SAP_AGREEMENT || null,
          tax_credit_rate: isSAP ? SAP_RATE : 0,
          tax_credit_amount: taxCreditAmt,
          html_worker: htmlWorker, html_client: htmlClient,
        })
      })

      // Envoyer par email
      const subjectWorker = isFR
        ? `Nynly — Votre reçu de mission (${invoiceNumber})`
        : `Nynly — Your mission receipt (${invoiceNumber})`
      const subjectClient = isFR
        ? `Nynly — Votre reçu + avantage fiscal (${invoiceNumber})`
        : `Nynly — Your receipt (${invoiceNumber})`

      const [sentW, sentC] = await Promise.all([
        worker.email ? sendEmail(worker.email, subjectWorker, htmlWorker, FROM_EMAIL) : Promise.resolve(false),
        client.email ? sendEmail(client.email, subjectClient, htmlClient, FROM_EMAIL) : Promise.resolve(false),
      ])

      log("info", `Receipt generated: ${invoiceNumber} | Worker: ${sentW} | Client: ${sentC}`)
      return new Response(
        JSON.stringify({ ok: true, invoice_number: invoiceNumber, sent_worker: sentW, sent_client: sentC }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      )

    } catch (e: any) {
      log("error", "receipt generation failed", { error: e.message, contract_id })
      return new Response(
        JSON.stringify({ ok: false, error: e.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }
  }

  // ── TYPE 2 : Récapitulatif annuel ─────────────────────────
  if (type === "annual") {
    const targetYear = year || new Date().getFullYear() - 1
    let processed = 0

    try {
      // Récupérer tous les users actifs
      const users = await db(
        `profiles?select=id,first_name,last_name,email,role,city,detected_country&is_active=eq.true`
      )
      if (!Array.isArray(users)) throw new Error("Could not fetch users")

      for (const user of users) {
        if (!user.email || !user.role) continue
        const role = user.role as "worker" | "client"
        const isFR = (user.detected_country || "US") === "FR"

        // Récupérer les invoices de l'année pour cet utilisateur
        const yearStart = `${targetYear}-01-01`
        const yearEnd   = `${targetYear}-12-31`
        const field     = role === "worker" ? "worker_id" : "client_id"

        const invoices = await db(
          `invoices?${field}=eq.${encodeURIComponent(user.id)}&invoice_date=gte.${yearStart}&invoice_date=lte.${yearEnd}&select=*`
        ).catch(() => [])

        const invList = Array.isArray(invoices) ? invoices : []
        if (invList.length === 0) continue

        // Calculer les totaux
        const totalMissions  = invList.length
        const totalHours     = invList.reduce((s: number, i: any) => s + parseFloat(i.duration_hours || 0), 0)
        const totalGross     = invList.reduce((s: number, i: any) => s + parseFloat(i.amount_gross || 0), 0)
        const totalCommission= invList.reduce((s: number, i: any) => s + parseFloat(i.commission_amount || 0), 0)
        const totalNet       = role === "worker"
          ? invList.reduce((s: number, i: any) => s + parseFloat(i.amount_worker || 0), 0)
          : totalGross - totalCommission
        const totalSAP       = isFR ? invList.filter((i: any) => i.is_sap_eligible).reduce((s: number, i: any) => s + parseFloat(i.amount_gross || 0), 0) : 0
        const totalTaxCredit = isFR ? totalSAP * SAP_RATE : 0

        const currency       = isFR ? "EUR" : "USD"
        const currencySymbol = isFR ? "€" : "$"

        // Détail par service
        const serviceMap: Record<string, { count: number; amount: number }> = {}
        for (const inv of invList) {
          const lbl = inv.service_label || inv.service_type || "Other"
          if (!serviceMap[lbl]) serviceMap[lbl] = { count: 0, amount: 0 }
          serviceMap[lbl].count++
          serviceMap[lbl].amount += parseFloat(inv.amount_gross || 0)
        }
        const topServices = Object.entries(serviceMap)
          .map(([label, v]) => ({ label, count: v.count, amount: v.amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)

        const html = buildAnnualHTML({
          year: targetYear, userRole: role,
          userName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          countryCode: user.detected_country || "US",
          totalMissions, totalHours, totalGross, totalCommission, totalNet,
          totalSAP, totalTaxCredit, currency, currencySymbol, topServices,
        })

        // Sauvegarder
        await db("annual_summaries", {
          method: "POST",
          body: JSON.stringify({
            user_id: user.id, user_role: role, year: targetYear,
            country_code: user.detected_country || "US",
            total_missions: totalMissions, total_hours: totalHours,
            total_gross: totalGross, total_commission: totalCommission, total_net: totalNet,
            total_sap_eligible: totalSAP, total_tax_credit: totalTaxCredit,
            currency, currency_symbol: currencySymbol,
            generated_at: new Date().toISOString(), html_content: html,
          })
        }).catch(() => {})

        // Envoyer par email
        const subject = isFR
          ? `Nynly — Votre récapitulatif fiscal ${targetYear}`
          : `Nynly — Your ${targetYear} Annual Tax Summary`

        const sent = await sendEmail(user.email, subject, html, FROM_EMAIL)
        if (sent) processed++
      }

      log("info", `Annual summaries ${targetYear}: ${processed} sent`)
      return new Response(
        JSON.stringify({ ok: true, year: targetYear, processed }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      )

    } catch (e: any) {
      log("error", "annual summary failed", { error: e.message })
      return new Response(
        JSON.stringify({ ok: false, error: e.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      )
    }
  }

  return new Response(
    JSON.stringify({ error: "Type requis: 'receipt' (+ contract_id) ou 'annual' (+ year optionnel)" }),
    { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
  )
})
