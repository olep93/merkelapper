/** Minimal representation of the shop's server-rendered active product, not just its variant catalogue. */
export function selectedPage(
  ean: string,
  size?: string,
  points: string[] = [],
) {
  return `<script>window.CURRENT_PAGE = ${JSON.stringify({
    ean,
    variationCode: `ObsBygg-${ean}`,
    sizeVariations: size ? [{ code: `ObsBygg-${ean}`, displayName: size }] : [],
    productUsps: points,
  })};</script><table><tr><td>Artikkelnummer</td><td>${ean}</td></tr></table>${size ? `<h4>Valgt størrelse<!-- -->:<!-- --> <span>${size}</span></h4>` : ""}`;
}
