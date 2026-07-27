import { escapeAttr, escapeHtml } from "@/lib/publishing/escape";
import type {
  CardStyle,
  FooterLayout,
  GalleryLayout,
  HeroLayout,
  NavStyle,
  TemplateSectionId,
  WebsiteTemplate,
} from "@/lib/templates/types";
import type { GeneratedWebsiteContent } from "@/types/website-content";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#contact", label: "Contact" },
] as const;

function cardClass(style: CardStyle): string {
  switch (style) {
    case "flat":
      return "site-card-flat";
    case "bordered":
      return "site-card-bordered";
    case "glass":
      return "site-card-glass";
    case "elevated":
    default:
      return "site-card-elevated";
  }
}

function headingBlock(
  eyebrow: string,
  title: string,
  description?: string,
  align: "left" | "center" = "center",
): string {
  const desc = description
    ? `<p>${escapeHtml(description)}</p>`
    : "";
  return `<div class="site-heading-block ${align}">
      <p class="site-eyebrow">${escapeHtml(eyebrow)}</p>
      <h2 class="site-heading">${escapeHtml(title)}</h2>
      ${desc}
    </div>`;
}

function renderNav(businessName: string, navStyle: NavStyle): string {
  const headerMod =
    navStyle === "minimal"
      ? "site-header-minimal"
      : navStyle === "underline"
        ? "site-header-underline"
        : navStyle === "pill"
          ? "site-header-pill"
          : "site-header-standard";

  const linkMod =
    navStyle === "underline"
      ? "site-nav-link-underline"
      : navStyle === "pill"
        ? "site-nav-link-pill"
        : "";

  const links = NAV_LINKS.map(
    (link) =>
      `<li><a class="site-link site-nav-link ${linkMod}" href="${link.href}">${escapeHtml(link.label)}</a></li>`,
  ).join("");

  const mobileLinks = NAV_LINKS.map(
    (link) =>
      `<li><a href="${link.href}">${escapeHtml(link.label)}</a></li>`,
  ).join("");

  return `<header class="site-header ${headerMod}">
  <nav class="site-shell site-nav" aria-label="Website">
    <a class="site-heading site-link site-brand" href="#home">${escapeHtml(businessName)}</a>
    <ul class="site-nav-desktop${navStyle === "pill" ? " pill" : ""}">${links}</ul>
    <details class="site-nav-details">
      <summary class="site-nav-toggle site-button" aria-label="Toggle menu">☰</summary>
      <ul class="site-nav-mobile">${mobileLinks}</ul>
    </details>
  </nav>
</header>`;
}

function renderHero(
  hero: GeneratedWebsiteContent["hero"],
  layout: HeroLayout,
): string {
  const primary = `<a class="site-button site-button-primary" href="#contact">${escapeHtml(hero.primaryCta)}</a>`;
  const secondary = `<a class="site-button site-button-secondary" href="#about">${escapeHtml(hero.secondaryCta)}</a>`;

  if (layout === "split") {
    return `<section id="home" class="site-hero site-hero-split">
  <div class="site-shell site-hero-split-grid">
    <div class="site-hero-content">
      <p class="site-eyebrow">${escapeHtml(hero.eyebrow)}</p>
      <h1 class="site-heading">${escapeHtml(hero.headline)}</h1>
      <p class="lede">${escapeHtml(hero.subheadline)}</p>
      <div class="site-hero-actions">${primary}${secondary}</div>
    </div>
    <div class="site-hero-split-image">
      <img src="${escapeAttr(hero.imageUrl)}" alt="" />
      <div class="site-hero-overlay" aria-hidden="true"></div>
    </div>
  </div>
</section>`;
  }

  const align = layout === "bold-overlay" ? "" : "center";
  const overlayExtra = layout === "bold-overlay" ? ' style="opacity:0.8"' : "";
  const wash =
    layout === "minimal"
      ? ""
      : `<div class="site-hero-wash" aria-hidden="true"></div>`;

  return `<section id="home" class="site-hero site-hero-${layout}">
  <div class="site-hero-media" aria-hidden="true">
    <img src="${escapeAttr(hero.imageUrl)}" alt="" />
    <div class="site-hero-overlay"${overlayExtra}></div>
    ${wash}
  </div>
  <div class="site-shell site-hero-content ${align}">
    <p class="site-eyebrow">${escapeHtml(hero.eyebrow)}</p>
    <h1 class="site-heading">${escapeHtml(hero.headline)}</h1>
    <p class="lede">${escapeHtml(hero.subheadline)}</p>
    <div class="site-hero-actions ${align}">${primary}${secondary}</div>
  </div>
</section>`;
}

function renderAbout(
  businessName: string,
  about: GeneratedWebsiteContent["about"],
  cardStyle: CardStyle,
): string {
  return `<section id="about" class="site-section site-section-bordered">
  <div class="site-shell site-about-grid">
    ${headingBlock("About", about.title, undefined, "left")}
    <div class="site-about-card ${cardClass(cardStyle)}">
      <p>${escapeHtml(about.description)}</p>
      <p class="site-about-signoff">— The team at ${escapeHtml(businessName)}</p>
    </div>
  </div>
</section>`;
}

function renderServices(
  services: GeneratedWebsiteContent["services"],
  cardStyle: CardStyle,
): string {
  const items = services
    .map(
      (service) => `<li class="${cardClass(cardStyle)}">
      <h3 class="site-heading">${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.description)}</p>
    </li>`,
    )
    .join("");

  return `<section id="services" class="site-section site-section-bordered">
  <div class="site-shell">
    ${headingBlock("Services", "What we offer")}
    <ul class="site-card-grid">${items}</ul>
  </div>
</section>`;
}

function renderFeatures(
  features: GeneratedWebsiteContent["features"],
  cardStyle: CardStyle,
): string {
  const items = features
    .map(
      (feature) => `<li class="${cardClass(cardStyle)}">
      <span class="site-feature-bar" aria-hidden="true"></span>
      <h3 class="site-heading">${escapeHtml(feature.title)}</h3>
      <p>${escapeHtml(feature.description)}</p>
    </li>`,
    )
    .join("");

  return `<section id="features" class="site-section site-section-bordered">
  <div class="site-shell">
    ${headingBlock("Why choose us", "What makes us different")}
    <ul class="site-card-grid">${items}</ul>
  </div>
</section>`;
}

function galleryLayoutClass(layout: GalleryLayout): string {
  switch (layout) {
    case "grid-3":
      return "site-gallery-grid-3";
    case "masonry":
      return "site-gallery-masonry";
    case "wide":
      return "site-gallery-wide";
    case "grid-2":
    default:
      return "site-gallery-grid-2";
  }
}

function renderGallery(
  items: GeneratedWebsiteContent["gallery"],
  layout: GalleryLayout,
): string {
  const tiles = items
    .map((item) => {
      const description = item.description
        ? `<span>${escapeHtml(item.description)}</span>`
        : "";
      return `<li class="site-gallery-item">
      <div class="site-gallery-frame">
        <img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.alt)}" />
      </div>
      <div class="site-gallery-caption">
        <strong>${escapeHtml(item.title)}</strong>
        ${description}
      </div>
    </li>`;
    })
    .join("");

  return `<section id="gallery" class="site-section site-section-bordered">
  <div class="site-shell">
    ${headingBlock("Gallery", "A look inside")}
    <ul class="site-gallery ${galleryLayoutClass(layout)}">${tiles}</ul>
  </div>
</section>`;
}

function renderContactForm(contact: GeneratedWebsiteContent["contact"]): string {
  const form = contact.form;
  if (!form.enabled || !form.formId || !form.apiBaseUrl) {
    return "";
  }

  const submitUrl = `${form.apiBaseUrl.replace(/\/+$/, "")}/api/forms/${encodeURIComponent(form.formId)}/submit`;
  const phoneField = form.showPhoneField
    ? `<label class="site-form-field">
        <span>Phone</span>
        <input type="tel" name="phone" autocomplete="tel" maxlength="40" />
      </label>`
    : "";
  const companyField = form.showCompanyField
    ? `<label class="site-form-field">
        <span>Company</span>
        <input type="text" name="company" autocomplete="organization" maxlength="200" />
      </label>`
    : "";

  // Inline script posts JSON to Atlas; escapes success message for JS string.
  const successJs = JSON.stringify(form.successMessage);
  const submitUrlJs = JSON.stringify(submitUrl);

  return `<form class="site-contact-form" data-atlas-contact-form novalidate>
    <label class="site-form-field">
      <span>Name</span>
      <input type="text" name="name" required autocomplete="name" maxlength="200" />
    </label>
    <label class="site-form-field">
      <span>Email</span>
      <input type="email" name="email" required autocomplete="email" maxlength="320" />
    </label>
    ${phoneField}
    ${companyField}
    <label class="site-form-field">
      <span>Message</span>
      <textarea name="message" required rows="4" maxlength="5000"></textarea>
    </label>
    <label class="site-form-honeypot" aria-hidden="true">
      <span>Website</span>
      <input type="text" name="website" tabindex="-1" autocomplete="off" />
    </label>
    <p class="site-form-status" hidden></p>
    <button type="submit" class="site-form-submit">${escapeHtml(form.buttonText)}</button>
  </form>
<script>
(function(){
  var form=document.querySelector("[data-atlas-contact-form]");
  if(!form) return;
  var statusEl=form.querySelector(".site-form-status");
  var btn=form.querySelector(".site-form-submit");
  var endpoint=${submitUrlJs};
  var successMessage=${successJs};
  form.addEventListener("submit", function(event){
    event.preventDefault();
    if(statusEl){ statusEl.hidden=true; statusEl.textContent=""; statusEl.className="site-form-status"; }
    var data=new FormData(form);
    var visitorId="";
    var sessionId="";
    try { visitorId=localStorage.getItem("atlas_vid")||""; } catch(e){}
    try { sessionId=sessionStorage.getItem("atlas_sid")||""; } catch(e){}
    var utmSource="", utmMedium="", utmCampaign="";
    try {
      var q=new URLSearchParams(location.search);
      utmSource=q.get("utm_source")||"";
      utmMedium=q.get("utm_medium")||"";
      utmCampaign=q.get("utm_campaign")||"";
    } catch(e){}
    var payload={
      name: String(data.get("name")||""),
      email: String(data.get("email")||""),
      phone: String(data.get("phone")||""),
      company: String(data.get("company")||""),
      message: String(data.get("message")||""),
      website: String(data.get("website")||""),
      sessionId: sessionId,
      visitorId: visitorId,
      landingPage: location.pathname||"/",
      referrer: document.referrer||"",
      utmSource: utmSource,
      utmMedium: utmMedium,
      utmCampaign: utmCampaign
    };
    if(btn){ btn.disabled=true; }
    fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    }).then(function(res){
      return res.json().then(function(body){ return { res:res, body:body }; });
    }).then(function(result){
      if(!statusEl) return;
      statusEl.hidden=false;
      if(result.res.ok && result.body && result.body.success){
        statusEl.className="site-form-status is-success";
        statusEl.textContent=result.body.message || successMessage;
        form.reset();
      } else {
        statusEl.className="site-form-status is-error";
        statusEl.textContent=(result.body && result.body.error) || "Could not send your message. Please try again.";
      }
    }).catch(function(){
      if(!statusEl) return;
      statusEl.hidden=false;
      statusEl.className="site-form-status is-error";
      statusEl.textContent="Could not send your message. Please try again.";
    }).finally(function(){
      if(btn){ btn.disabled=false; }
    });
  });
})();
</script>`;
}

function renderContact(
  contact: GeneratedWebsiteContent["contact"],
  footerLayout: FooterLayout,
  cardStyle: CardStyle,
): string {
  const details = contact.details;
  const formHtml = renderContactForm(contact);

  if (footerLayout === "split") {
    const tiles = details
      .map(
        (detail) => `<div class="site-contact-tile ${cardClass(cardStyle)}">
        <dt>${escapeHtml(detail.label)}</dt>
        <dd title="${escapeAttr(detail.value)}">${escapeHtml(detail.value)}</dd>
      </div>`,
      )
      .join("");

    return `<section id="contact" class="site-section">
  <div class="site-shell">
    <div class="site-contact-panel">
      <div class="site-contact-split">
        ${headingBlock("Contact", contact.title, contact.description, "left")}
        <div>
          <dl class="site-contact-details">${tiles}</dl>
          ${formHtml}
        </div>
      </div>
    </div>
  </div>
</section>`;
  }

  if (footerLayout === "stacked" || footerLayout === "minimal") {
    const rows = details
      .map(
        (detail) => `<div class="site-contact-row">
        <dt>${escapeHtml(detail.label)}</dt>
        <dd title="${escapeAttr(detail.value)}">${escapeHtml(detail.value)}</dd>
      </div>`,
      )
      .join("");
    const align = footerLayout === "minimal" ? "left" : "center";
    const description =
      footerLayout === "minimal" ? undefined : contact.description;

    return `<section id="contact" class="site-section">
  <div class="site-shell">
    <div class="site-contact-panel">
      ${headingBlock("Contact", contact.title, description, align)}
      <dl class="site-contact-stack ${align === "center" ? "center" : ""}">${rows}</dl>
      ${formHtml}
    </div>
  </div>
</section>`;
  }

  const tiles = details
    .map(
      (detail) => `<div class="site-contact-tile ${cardClass(cardStyle)}">
      <dt>${escapeHtml(detail.label)}</dt>
      <dd title="${escapeAttr(detail.value)}">${escapeHtml(detail.value)}</dd>
    </div>`,
    )
    .join("");

  return `<section id="contact" class="site-section">
  <div class="site-shell">
    <div class="site-contact-panel">
      ${headingBlock("Contact", contact.title, contact.description)}
      <dl class="site-contact-details cols-3">${tiles}</dl>
      ${formHtml}
    </div>
  </div>
</section>`;
}

function renderSection(
  sectionId: TemplateSectionId,
  content: GeneratedWebsiteContent,
  template: WebsiteTemplate,
): string {
  switch (sectionId) {
    case "hero":
      return renderHero(content.hero, template.heroLayout);
    case "about":
      return renderAbout(content.businessName, content.about, template.cardStyle);
    case "services":
      return renderServices(content.services, template.cardStyle);
    case "features":
      return renderFeatures(content.features, template.cardStyle);
    case "gallery":
      return renderGallery(content.gallery, template.galleryLayout);
    case "contact":
      return renderContact(
        content.contact,
        template.footerLayout,
        template.cardStyle,
      );
    default:
      return "";
  }
}

/**
 * Render the full document body for a template + resolved content.
 * Section order and layout variants come from WebsiteTemplate (extensible).
 */
export function renderStaticSiteBody(
  content: GeneratedWebsiteContent,
  template: WebsiteTemplate,
): string {
  const sections = template.sectionOrder
    .map((sectionId) => renderSection(sectionId, content, template))
    .join("\n");

  return `<div class="site-canvas" data-template="${escapeAttr(template.id)}" data-card-style="${escapeAttr(template.cardStyle)}" data-hero-layout="${escapeAttr(template.heroLayout)}" data-nav-style="${escapeAttr(template.navStyle)}" data-gallery-layout="${escapeAttr(template.galleryLayout)}" data-footer-layout="${escapeAttr(template.footerLayout)}">
${renderNav(content.businessName, template.navStyle)}
<main>
${sections}
</main>
</div>`;
}

export function renderStaticSiteDocument(input: {
  title: string;
  description: string;
  bodyHtml: string;
  stylesHref?: string;
  fontsHref: string;
  /** Pre-rendered, escaped SEO head tags (title/meta/og/canonical/favicon). */
  seoHeadHtml?: string;
  /** Pre-rendered JSON-LD script tag(s). */
  jsonLdHtml?: string;
  /** Pre-rendered Atlas analytics beacon (before </body>). */
  analyticsScriptHtml?: string;
  /** Free-plan "Built with Atlas" badge HTML. */
  brandingHtml?: string;
}): string {
  const styles = input.stylesHref ?? "styles.css";
  const seoHead =
    input.seoHeadHtml?.trim() ||
    `  <title>${escapeHtml(input.title)}</title>
  <meta name="description" content="${escapeAttr(input.description)}" />`;
  const jsonLd = input.jsonLdHtml?.trim()
    ? `\n  ${input.jsonLdHtml.trim()}`
    : "";
  const analytics = input.analyticsScriptHtml?.trim()
    ? `\n${input.analyticsScriptHtml.trim()}`
    : "";
  const branding = input.brandingHtml?.trim()
    ? `\n${input.brandingHtml.trim()}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
${seoHead}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${escapeAttr(input.fontsHref)}" rel="stylesheet" />
  <link rel="stylesheet" href="${escapeAttr(styles)}" />${jsonLd}
</head>
<body>
${input.bodyHtml}${branding}${analytics}
</body>
</html>
`;
}
