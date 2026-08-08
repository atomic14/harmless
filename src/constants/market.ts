// The 1984 market model, as the career reads it: the domain of the
// fluctuation byte.
//
// The model itself — base prices, gradients, masks — is galaxy/galaxy.ts's
// table and stays there as DATA. This file holds the one number the career
// spends: how many values the fluctuation byte can take.

/**
 * Every value the market's fluctuation byte can take. A byte, so 256 — the
 * original rolls one per visit under a mask. The single home for the count:
 * `marketEstimate` averages over all of them for an exact mean, and fresh-market
 * rolls draw a fluctuation below it.
 */
export const FLUCTUATIONS = 256;
