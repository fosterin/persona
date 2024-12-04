/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { LucidModel } from '@adonisjs/lucid/types/model'

/**
 * Options accepted by the email tokens provider
 */
export type EmailTokensProviderOptions<TokenableModel extends LucidModel> = {
  /**
   * The user model for which to generate tokens. Note, the model
   * is not used to generate tokens, but is used to associate
   * a user with the token.
   */
  tokenableModel: TokenableModel

  /**
   * Database table to use for querying tokens.
   *
   * Defaults to "email_verification_tokens"
   */
  table?: string

  /**
   * The length for the token secret. A secret is a cryptographically
   * secure random string.
   *
   * Defaults to 40
   */
  tokenSecretLength?: number

  /**
   * The default expiry for all the tokens. The value must be a number
   * in seconds or a time expression as a string.
   *
   * Defaults to 1 day
   */
  expiresIn?: string | number
}

/**
 * The database columns expected at the database level
 */
export type EmailTokenDbColumns = {
  /**
   * Token primary key. It can be an integer, bigInteger or
   * even a UUID or any other string based value.
   *
   * The id should not have ". (dots)" inside it.
   */
  id: number | string | BigInt

  /**
   * Email for which the token is generated
   */
  email: string

  /**
   * The user or entity for whom the token is
   * generated
   */
  tokenable_id: string | number | BigInt

  /**
   * Token hash is used to verify the token shared
   * with the user
   */
  hash: string

  /**
   * Timestamps
   */
  created_at: Date

  /**
   * The date after which the token will be considered
   * expired.
   */
  expires_at: Date
}
