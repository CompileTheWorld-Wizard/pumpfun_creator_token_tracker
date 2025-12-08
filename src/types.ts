/**
 * PumpFun Event Types
 * Types for token creation and trading events on pump.fun
 */

// ============================================================================
// Base Event Type
// ============================================================================

/** Base event interface with name and data fields */
export interface BaseEvent<TName extends string = string, TData = unknown> {
  name: TName;
  data: TData;
}

// ============================================================================
// Token Create Event (pump.fun bonding curve)
// ============================================================================

export interface CreateEventData {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bonding_curve: string;
  user: string;
  creator: string;
  timestamp: number;
  virtual_token_reserves: number;
  virtual_sol_reserves: number;
  real_token_reserves: number;
  token_total_supply: number;
}

export type CreateEvent = BaseEvent<'CreateEvent', CreateEventData>;

// ============================================================================
// Trade Event (pump.fun bonding curve - Buy/Sell)
// ============================================================================

export interface TradeEventData {
  mint: string;
  sol_amount: number;
  token_amount: number;
  is_buy: boolean;
  user: string;
  timestamp: number;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  fee_recipient: string;
  fee_basis_points: number;
  fee: number;
  creator: string;
  creator_fee_basis_points: number;
  creator_fee: number;
  track_volume: boolean;
  total_unclaimed_tokens: number;
  total_claimed_tokens: number;
  current_sol_volume: number;
  last_update_timestamp: number;
  ix_name: 'buy' | 'sell';
}

export type TradeEvent = BaseEvent<'TradeEvent', TradeEventData>;

// ============================================================================
// AMM Buy Event (pump.fun AMM - User sells tokens to get SOL)
// ============================================================================

export interface AmmBuyEventData {
  timestamp: number;
  base_amount_out: number;
  max_quote_amount_in: number;
  user_base_token_reserves: number;
  user_quote_token_reserves: number;
  pool_base_token_reserves: number;
  pool_quote_token_reserves: number;
  quote_amount_in: number;
  lp_fee_basis_points: number;
  lp_fee: number;
  protocol_fee_basis_points: number;
  protocol_fee: number;
  quote_amount_in_with_lp_fee: number;
  user_quote_amount_in: number;
  pool: string;
  user: string;
  user_base_token_account: string;
  user_quote_token_account: string;
  protocol_fee_recipient: string;
  protocol_fee_recipient_token_account: string;
  coin_creator: string;
  coin_creator_fee_basis_points: number;
  coin_creator_fee: number;
  track_volume?: boolean;
  total_unclaimed_tokens?: number;
  total_claimed_tokens?: number;
  current_sol_volume?: number;
  last_update_timestamp?: number;
}

export type AmmBuyEvent = BaseEvent<'BuyEvent', AmmBuyEventData>;

// ============================================================================
// AMM Sell Event (pump.fun AMM - User sells SOL to get tokens)
// ============================================================================

export interface AmmSellEventData {
  timestamp: number;
  base_amount_in: number;
  min_quote_amount_out: number;
  user_base_token_reserves: number;
  user_quote_token_reserves: number;
  pool_base_token_reserves: number;
  pool_quote_token_reserves: number;
  quote_amount_out: number;
  lp_fee_basis_points: number;
  lp_fee: number;
  protocol_fee_basis_points: number;
  protocol_fee: number;
  quote_amount_out_without_lp_fee: number;
  user_quote_amount_out: number;
  pool: string;
  user: string;
  user_base_token_account: string;
  user_quote_token_account: string;
  protocol_fee_recipient: string;
  protocol_fee_recipient_token_account: string;
  coin_creator: string;
  coin_creator_fee_basis_points: number;
  coin_creator_fee: number;
}

export type AmmSellEvent = BaseEvent<'SellEvent', AmmSellEventData>;

// ============================================================================
// Union Types
// ============================================================================

/** All pump.fun bonding curve events */
export type PumpFunCurveEvent = CreateEvent | TradeEvent;

/** All pump.fun AMM events */
export type PumpFunAmmEvent = AmmBuyEvent | AmmSellEvent;

/** All pump.fun events */
export type PumpFunEvent = PumpFunCurveEvent | PumpFunAmmEvent;

// ============================================================================
// Type Guards
// ============================================================================

export function isCreateEvent(event: PumpFunEvent): event is CreateEvent {
  return event.name === 'CreateEvent';
}

export function isTradeEvent(event: PumpFunEvent): event is TradeEvent {
  return event.name === 'TradeEvent';
}

export function isAmmBuyEvent(event: PumpFunEvent): event is AmmBuyEvent {
  return event.name === 'BuyEvent';
}

export function isAmmSellEvent(event: PumpFunEvent): event is AmmSellEvent {
  return event.name === 'SellEvent';
}

export function isBuyTrade(event: TradeEvent): boolean {
  return event.data.is_buy === true;
}

export function isSellTrade(event: TradeEvent): boolean {
  return event.data.is_buy === false;
}

