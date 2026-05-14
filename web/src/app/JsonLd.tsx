/**
 * Structured data (JSON-LD) for rich-result eligibility on Google.
 *
 * Two graphs:
 *   - Organization (about codewithmuh as the publisher)
 *   - SoftwareApplication (about Bandit as the product)
 *
 * Rendered into <head> via Next.js's <script> in a Server Component.
 * Use Google's Rich Results Test to validate: https://search.google.com/test/rich-results
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://cartlift.codewithmuh.com";

export default function JsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: "Cartlift Labs",
        url: SITE,
        logo: `${SITE}/icon-512.svg`,
        founder: {
          "@type": "Person",
          name: "Muhammad Rashid Daha",
          alternateName: "codewithmuh",
          url: "https://www.youtube.com/@codewithmuh",
          sameAs: [
            "https://www.youtube.com/@codewithmuh",
            "https://github.com/codewithmuh",
            "https://linkedin.com/in/muhammad-rashid-daha",
            "https://x.com/codewithmuh",
          ],
        },
        sameAs: [
          "https://github.com/codewithmuh/cartlift",
          "https://www.youtube.com/@codewithmuh",
          "https://x.com/codewithmuh",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "contact@codewithmuh.com",
          availableLanguage: ["English"],
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE}/#software`,
        name: "Cartlift",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Ecommerce Conversion Rate Optimization",
        operatingSystem: "Web · Linux · macOS · Windows (self-hosted)",
        url: SITE,
        description:
          "Cartlift is the open-source CRO platform for ecommerce. Audits store pages for conversion, SEO, trust and Google Merchant — then drafts page variants and runs A/B tests via Thompson sampling. Lift AOV, conversion, and repeat-customer rate.",
        license: "https://opensource.org/licenses/MIT",
        codeRepository: "https://github.com/codewithmuh/cartlift",
        programmingLanguage: ["TypeScript", "Python"],
        softwareVersion: "0.1.0",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: "Free + open source (MIT). Self-host or use the hosted plan.",
        },
        author: { "@id": `${SITE}/#org` },
        publisher: { "@id": `${SITE}/#org` },
        featureList: [
          "Ecommerce conversion-rate optimization audit",
          "SEO audit (Product + Offer + Review schema)",
          "Trust + policy compliance audit",
          "Google Merchant Center suspension audit",
          "AI-drafted PDP / cart / checkout variants",
          "Multi-armed bandit traffic allocation (Thompson sampling)",
          "JS snippet — install in Shopify, WooCommerce, BigCommerce, or any headless front-end",
          "Self-hostable on Docker",
          "Bring your own LLM key (Anthropic Claude)",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#site`,
        url: SITE,
        name: "Cartlift",
        publisher: { "@id": `${SITE}/#org` },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
