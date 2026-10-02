export type CommerceEvent = {
  name:
    | 'view_item'
    | 'add_to_cart'
    | 'remove_from_cart'
    | 'view_cart'
    | 'begin_checkout'
    | 'login'
    | 'sign_up'
    | 'add_to_wishlist'
    | 'search'
    | 'purchase';
  itemId?: string;
  quantity?: number;
  valueKobo?: number;
};
export interface AnalyticsAdapter {
  track(event: CommerceEvent): void;
}
export const analytics: AnalyticsAdapter = {
  track: () => {
    /* Deliberately no tracking until an approved, consent-aware adapter is supplied. */
  },
};
