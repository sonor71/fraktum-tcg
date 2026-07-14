import type { OpenPassportDetail } from "./cardPassportTypes";

export { CardPassportHost } from "./CardPassportHost";
export type { CardPassportData, OpenPassportDetail } from "./cardPassportTypes";

/**
 * Для Canvas / Three.js / WebGL-сцен, где глобальный ПКМ не может распознать DOM-изображение.
 */
export function openCardPassport(detail: OpenPassportDetail) {
  window.dispatchEvent(
    new CustomEvent<OpenPassportDetail>("fraktum:open-card-passport", {
      detail,
    }),
  );
}
