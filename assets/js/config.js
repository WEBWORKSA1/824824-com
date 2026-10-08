/* =====================================================================
   824824.com — runtime settings. This is the only script you need to edit.
   ===================================================================== */
window.SITE = {
  name: "824824",
  partnerContact: "https://web.works/contact",

  /* Google AdSense. The loader script is already on every content page (Auto ads work
     once the site is approved). To add fixed ad units, create them in AdSense
     (Ads > By ad unit) and paste each slot id below. A slot can also be an object:
     { id: "1234567890", format: "fluid", layout: "in-article" }.
     Empty slot = a house promo fills that space. */
  adsense: {
    client: "ca-pub-6620975821265271",
    slots: {
      "in-article": "",
      "after-tool": "",
      "sidebar": "",
      "home": ""
    }
  },

  /* Google Analytics 4 measurement id, e.g. "G-ABC123XYZ". Empty = no analytics. */
  ga4: "",

  /* YouTube: your channel URL shows a Subscribe button on the Videos page. */
  youtube: {
    channel: ""
  },

  /* Donation links. Empty = the pledge form is used and we follow up by email.
     Use {amount} in a link to pass the chosen amount, e.g. "https://paypal.me/yourname/{amount}". */
  donate: {
    paypal: "",
    stripe: "",
    buymeacoffee: "",
    kofi: "",
    patreon: ""
  },

  /* FormSubmit alias. After the first form submission, FormSubmit emails an activation link
     and a random-string alias. Paste the alias here to remove even the obfuscated inbox from
     the site. Empty = the obfuscated routing below is used. */
  formAlias: ""
};

/* Form routing: obfuscated, assembled only at submit time. Never replace with plain text. */
window.__r = [18, 12, 5, 31, 27, 95, 4, 21, 76, 3, 116, 2, 4, 6, 1, 24, 3, 12, 9, 64];
window.__k = "eight-of-24";
