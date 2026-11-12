/**
 * Main (card) photo for each imported product, keyed by the source site's product id.
 * All are text-free spice photos: four are the original photos, four are crops of the
 * original posters with the printed title removed (public/images/products/clean/).
 */
export const CLEAN_PHOTOS: Record<number, string> = {
  15: "/images/products/clean/mace.jpg",
  16: "/images/products/clean/star-anise.jpg",
  17: "/images/products/60c7769efa196c3e6be41ca1bb1e963b.jpg", // cardamom
  18: "/images/products/clean/clove.jpg",
  19: "/images/products/clean/nutmeg.jpg",
  20: "/images/products/78907dea96f2b926ce7b10dd451345a5.jpg", // cassia cinnamon
  21: "/images/products/9e33828e050ed4a298166a05f9895677.jpg", // bay leaf
  22: "/images/products/a2bf90b5a8a823e0fa1ee9bac09a1360.jpg", // black pepper
};
