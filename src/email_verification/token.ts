/*
 * @adonisjs/persona
 *
 * (C) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Secret, VerificationToken } from '@adonisjs/core/helpers'

/**
 * Email verification token represents an opaque token that can be
 * used to verify an email address of the user.
 */
export class EmailVerificationToken extends VerificationToken {
  /**
   * The email address for which the token was generated.
   */
  email: string

  /**
   * Date/time when the token instance was created
   */
  createdAt: Date

  constructor(attributes: {
    identifier: string | number | BigInt
    tokenableId: string | number | BigInt
    email: string
    hash: string
    createdAt: Date
    expiresAt: Date
    secret?: Secret<string>
  }) {
    super()
    this.identifier = attributes.identifier
    this.tokenableId = attributes.tokenableId
    this.hash = attributes.hash
    this.email = attributes.email
    this.createdAt = attributes.createdAt
    this.expiresAt = attributes.expiresAt

    /**
     * Compute value when secret is provided
     */
    if (attributes.secret) {
      this.computeValue(attributes.secret)
    }
  }
}
